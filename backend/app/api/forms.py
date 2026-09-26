"""AI Form Assistant API. Every route resolves the form through ``owned_form`` (id AND authenticated user id);
a form that belongs to someone else is indistinguishable from one that doesn't exist (404)."""
from __future__ import annotations

import hashlib
import logging
import re

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.database import SessionLocal, get_db
from app.models import Form, FormAssistanceSession, FormField, FormNote, FormPage, FormValue, User
from app.models.common import new_id, utcnow
from app.services.formdoc import analyze, fill, service, storage
from app.services.formdoc.block_letters import asks_for_block_letters
from app.services.formdoc.assistant import FormAssistant
from app.services.formdoc.validate import UploadRejected, validate_upload
from app.services.formdoc.values import profile_suggestions
from app.services.reference import ownership_ok as ref_ownership_ok, resolve as resolve_reference

log = logging.getLogger("forms.api")
router = APIRouter(prefix="/api/forms", tags=["forms"])

PDF_FAIL = "I couldn't generate the completed PDF. Your original form has not been modified."


# --------------------------------------------------------------------------- helpers
def owned_form(db: Session, form_id: str, user: User) -> Form:
    form = db.scalar(select(Form).where(Form.id == form_id, Form.user_id == user.id))
    if form is None:
        raise HTTPException(404, "Form not found")
    return form


def form_out(f: Form) -> dict:
    try:
        ready = f.output_at is not None and storage.completed_path(f.user_id, f.id).is_file()
    except storage.StorageError:
        ready = False
    return {"id": f.id, "original_filename": f.original_filename, "mime_type": f.mime_type, "kind": f.kind, "file_size": f.file_size,
            "page_count": f.page_count, "status": f.status, "error": f.error, "analysis": f.analysis or {}, "output_ready": ready,
            "output_at": f.output_at.isoformat() if f.output_at else None, "created_at": f.created_at.isoformat(), "updated_at": f.updated_at.isoformat()}


def _open_session(db: Session, form: Form, user: User, language: str = "en", screen: bool | None = None) -> FormAssistanceSession:
    s = db.scalar(select(FormAssistanceSession).where(FormAssistanceSession.form_id == form.id, FormAssistanceSession.user_id == user.id,
                                                      FormAssistanceSession.ended_at.is_(None)).order_by(FormAssistanceSession.started_at.desc()))
    if s is None:
        s = FormAssistanceSession(form_id=form.id, user_id=user.id, language=language, state={})
        db.add(s)
        db.flush()
    if screen is not None:
        s.screen_shared = screen
    return s


def _require_ready(form: Form) -> None:
    if form.status not in ("READY", "COMPLETED"):
        raise HTTPException(409, "This form has not been analysed yet." if form.status != "FAILED" else (form.error or "Analysis failed."))


# --------------------------------------------------------------------------- upload / list / get / delete
@router.post("/upload", status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    limit = settings.max_form_bytes
    chunks, total = [], 0
    while chunk := await file.read(1 << 20):
        total += len(chunk)
        if total > limit:
            raise HTTPException(413, f"The file is too large. The limit is {settings.MAX_FORM_SIZE_MB} MB.")
        chunks.append(chunk)
    data = b"".join(chunks)
    try:
        v = await run_in_threadpool(validate_upload, file.filename, file.content_type, data)
    except UploadRejected as exc:
        raise HTTPException(exc.status, str(exc))
    form = Form(id=new_id(), user_id=user.id, original_filename=v.display_name, stored_filename="", mime_type=v.mime, kind=v.kind,
                file_size=v.size, sha256=v.sha256, page_count=v.page_count, status="UPLOADED")
    try:
        form.stored_filename = storage.store_original(user.id, form.id, v.store_ext, data)
        db.add(form)
        db.commit()
    except Exception:  # noqa: BLE001 - never leave an orphaned file without a database row
        db.rollback()
        try:
            storage.remove_form_files(user.id, form.id)
            storage.purge_trash(user.id)
        except Exception:  # noqa: BLE001
            log.exception("Cleanup after failed upload")
        raise HTTPException(500, "The upload could not be saved. Please try again.")
    return form_out(form)


@router.get("")
def list_forms(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [form_out(f) for f in db.scalars(select(Form).where(Form.user_id == user.id).order_by(Form.created_at.desc())).all()]


@router.get("/{form_id}")
def get_form(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return form_out(owned_form(db, form_id, user))


@router.delete("/{form_id}")
def delete_form(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Files are moved aside atomically, rows are deleted in one transaction, then the files are purged.
    If the database step fails the files are restored, so a form is never left half-deleted."""
    form = owned_form(db, form_id, user)
    trash = storage.remove_form_files(user.id, form.id)
    try:
        for model in (FormValue, FormNote, FormAssistanceSession, FormField, FormPage):
            db.execute(delete(model).where(model.form_id == form.id, model.user_id == user.id))
        db.delete(form)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        storage.restore_form_files(trash, user.id, form_id)
        raise HTTPException(500, "The form could not be deleted. Nothing was removed.")
    storage.purge_trash(user.id)
    return {"ok": True}


# --------------------------------------------------------------------------- analysis and schema
def _run_analysis(form_id: str, user_id: str) -> None:
    db = SessionLocal()
    try:
        form = db.scalar(select(Form).where(Form.id == form_id, Form.user_id == user_id))
        if form is not None:
            analyze.analyze_form(db, form)
    except Exception:  # noqa: BLE001
        log.exception("Background analysis crashed")
        db.rollback()
        form = db.scalar(select(Form).where(Form.id == form_id, Form.user_id == user_id))
        if form is not None:
            form.status, form.error = "FAILED", "I couldn't analyse this form. Your original file has not been modified."
            db.commit()
    finally:
        db.close()


class AnalyzeIn(BaseModel):
    force: bool = False


@router.post("/{form_id}/analyze", status_code=202)
def analyze_endpoint(form_id: str, background: BackgroundTasks, body: AnalyzeIn | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    if form.status == "ANALYZING":
        return form_out(form)
    if form.status in ("READY", "COMPLETED") and not (body and body.force):
        return form_out(form)
    form.status, form.error = "ANALYZING", None
    db.commit()
    background.add_task(_run_analysis, form.id, user.id)
    return form_out(form)


def _schema_payload(db: Session, form: Form, user: User) -> dict:
    fields = service.load_fields(db, form)
    rows = service.load_value_rows(db, form)
    values, skipped, blank = service.split_values(rows)
    pages = db.scalars(select(FormPage).where(FormPage.form_id == form.id, FormPage.user_id == user.id).order_by(FormPage.page_number)).all()
    sess = db.scalar(select(FormAssistanceSession).where(FormAssistanceSession.form_id == form.id, FormAssistanceSession.user_id == user.id,
                                                         FormAssistanceSession.ended_at.is_(None)))
    clar = bool(sess and (sess.state or {}).get("clarify"))
    sm = service.summarize(fields, values, skipped, blank, clar)
    return {"form": form_out(form),
            "pages": [{"page": p.page_number, "width": p.width, "height": p.height, "text_source": p.text_source,
                       "ocr_confidence": p.ocr_confidence, "warnings": p.warnings or []} for p in pages],
            "fields": [service.public_field(f) for f in fields],
            "values": values, "sources": {fid: r.source for fid, r in rows.items() if fid in values},
            "summary": sm, "ai_notes": service.ai_notes(form, fields, values, skipped, blank, list(pages), clar),
            "profile_suggestions": {k: v for k, v in profile_suggestions(fields, user.full_name, user.profile or {}).items() if k not in values}}


@router.get("/{form_id}/schema")
def schema(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    return _schema_payload(db, form, user)


# --------------------------------------------------------------------------- AutoFill
class AutoFillIn(BaseModel):
    values: dict[str, str | bool | list[str] | None] = Field(default_factory=dict)
    use_profile: bool = False
    skip: list[str] = Field(default_factory=list)
    rename: dict[str, str] = Field(default_factory=dict)  # field_id -> corrected label/type (manual fix of a doubtful field)


@router.post("/{form_id}/autofill")
def autofill(form_id: str, body: AutoFillIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    if len(body.values) > 300:
        raise HTTPException(422, "Too many values")
    fields = service.load_fields(db, form)
    incoming = dict(body.values)
    sources: dict[str, str] = {}
    if body.use_profile:
        rows = service.load_value_rows(db, form)
        have, _, _ = service.split_values(rows)
        for fid, v in profile_suggestions(fields, user.full_name, user.profile or {}).items():
            if fid not in have and fid not in incoming:
                incoming[fid] = v
                sources[fid] = "profile"
    saved, errors = {}, {}
    user_vals = {k: v for k, v in incoming.items() if k not in sources}
    if user_vals:
        s1, e1 = service.apply_values(db, form, fields, user_vals, "user")
        saved.update(s1), errors.update(e1)
    prof_vals = {k: v for k, v in incoming.items() if k in sources}
    if prof_vals:
        s2, e2 = service.apply_values(db, form, fields, prof_vals, "profile")
        saved.update(s2), errors.update(e2)
    by_id = {f["field_id"]: f for f in fields}
    for fid in body.skip:
        if fid in by_id:
            service.set_marker(db, form, fid, "skipped")
    for fid, new_label in body.rename.items():  # the citizen names a field the AI could not identify
        row = db.scalar(select(FormField).where(FormField.form_id == form.id, FormField.user_id == user.id, FormField.field_id == fid))
        if row is not None and new_label.strip():
            row.label = new_label.strip()[:200]
            row.confidence = 1.0
            row.source = row.source if row.source == "acroform" else "user"
    db.commit()
    return _schema_payload(db, form, user) | {"saved": saved, "errors": errors}


# --------------------------------------------------------------------------- assistant
class AssistantIn(BaseModel):
    message: str = Field("", max_length=2000)
    current_field_id: str | None = Field(None, max_length=32)  # a field the citizen deliberately picked
    pending_field_id: str | None = Field(None, max_length=32)  # echo of the last "pending_field_id" the server sent
    input_mode: str = Field("text", pattern="^(text|voice)$")  # for logging only; never changes routing
    language: str = Field("en", max_length=8)
    frame: str | None = Field(None, max_length=6_000_000)  # base64 JPEG of the shared screen; used in memory, never stored
    screen_shared: bool = False
    reference_message_id: str | None = None
    reference_text: str | None = Field(default=None, max_length=1200)


@router.post("/{form_id}/assistant")
def assistant(form_id: str, body: AssistantIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    session = _open_session(db, form, user, body.language, body.screen_shared)
    session.language = body.language
    log.info("Form assistant turn (input_mode=%s)", body.input_mode)
    ref = None
    if body.reference_message_id:
        if not ref_ownership_ok(body.reference_message_id, user.id, db):
            raise HTTPException(403, "Reference not found")
        ref = resolve_reference(body.reference_message_id, body.reference_text, db)
    elif body.reference_text:
        ref = resolve_reference(None, body.reference_text, db)
    return FormAssistant(db, user, form, session).handle(body.message, body.current_field_id, body.frame if body.screen_shared else None, body.language,
                                                         pending_field_id=body.pending_field_id, input_mode=body.input_mode,
                                                         reference=ref)


@router.get("/{form_id}/assistant")
def assistant_history(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    s = db.scalar(select(FormAssistanceSession).where(FormAssistanceSession.form_id == form.id, FormAssistanceSession.user_id == user.id,
                                                      FormAssistanceSession.ended_at.is_(None)))
    st = (s.state or {}) if s else {}
    return {"history": st.get("history", []), "asking": st.get("asking"), "clarification": bool(st.get("clarify")), "active": s is not None}


@router.post("/{form_id}/assistant/end")
def assistant_end(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    for s in db.scalars(select(FormAssistanceSession).where(FormAssistanceSession.form_id == form.id, FormAssistanceSession.user_id == user.id,
                                                            FormAssistanceSession.ended_at.is_(None))).all():
        s.ended_at, s.screen_shared = utcnow(), False
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- review / generate / preview / download
@router.get("/{form_id}/review")
def review(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    fields = service.load_fields(db, form)
    values, skipped, blank = service.split_values(service.load_value_rows(db, form))
    items = service.review_items(fields, values, skipped, blank)
    missing = [i for i in items if i["required"] and i["status"] in ("missing", "skipped")]
    page_texts = db.scalars(select(FormPage.extracted_text).where(FormPage.form_id == form.id, FormPage.user_id == user.id)).all()
    return {"items": items, "missing": [{"field_id": i["field_id"], "label": i["label"]} for i in missing], "can_generate": not missing,
            "block_letters": asks_for_block_letters(page_texts)}


class GenerateIn(BaseModel):
    allow_blank: list[str] = Field(default_factory=list)  # required fields the citizen explicitly chose to leave empty
    block_letters: bool | None = None  # None = write in capitals only if the form itself asks for BLOCK LETTERS


@router.post("/{form_id}/generate")
def generate(form_id: str, body: GenerateIn | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    fields = service.load_fields(db, form)
    values, skipped, blank = service.split_values(service.load_value_rows(db, form))
    by_id = {f["field_id"]: f for f in fields}
    for fid in (body.allow_blank if body else []):
        f = by_id.get(fid)
        if f is not None and service.field_status(f, values, skipped, blank) in ("missing", "skipped"):
            service.set_marker(db, form, fid, "blank")
            blank.add(fid)
            skipped.discard(fid)
    missing = [{"field_id": f["field_id"], "label": f["label"]} for f in fields
               if f["required"] and service.field_status(f, values, skipped, blank) in ("missing", "skipped")]
    if missing:
        db.rollback()
        raise HTTPException(422, {"code": "missing_required", "message": "Some required fields are empty.", "missing": missing})
    try:
        src = storage.original_path(user.id, form.id, form.stored_filename)
        data = src.read_bytes()  # read-only: the original is never opened for writing
        if hashlib.sha256(data).hexdigest() != form.sha256:
            raise fill.GenerationError("original changed")
        page_rows = db.scalars(select(FormPage).where(FormPage.form_id == form.id, FormPage.user_id == user.id)).all()
        pages = {p.page_number: (p.width, p.height) for p in page_rows}
        images = {n: storage.page_image_path(user.id, form.id, n) for n in pages}
        block = body.block_letters if body and body.block_letters is not None else asks_for_block_letters(p.extracted_text for p in page_rows)
        warnings = fill.generate_pdf(data, form.kind, images, pages, fields, values, storage.completed_path(user.id, form.id), block_letters=block)
        if hashlib.sha256(src.read_bytes()).hexdigest() != form.sha256:  # belt and braces
            log.error("Original file digest changed during generation")
            storage.completed_path(user.id, form.id).unlink(missing_ok=True)
            raise fill.GenerationError("original changed")
    except (fill.GenerationError, OSError, storage.StorageError):
        db.rollback()
        raise HTTPException(500, PDF_FAIL)
    form.status, form.output_at = "COMPLETED", utcnow()
    db.commit()
    return {"ok": True, "warnings": warnings, "form": form_out(form)}


@router.get("/{form_id}/preview")
def preview(form_id: str, page: int = 1, source: str = "original", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    _require_ready(form)
    if not 1 <= page <= max(form.page_count, 1):
        raise HTTPException(404, "Page not found")
    headers = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}
    if source == "completed":
        path = storage.completed_path(user.id, form.id)
        if form.output_at is None or not path.is_file():
            raise HTTPException(404, "The completed PDF has not been generated yet")
        import fitz

        with fitz.open(str(path)) as doc:
            png = doc[page - 1].get_pixmap(dpi=130, alpha=False).tobytes("png")
        return Response(png, media_type="image/png", headers=headers)
    if source != "original":
        raise HTTPException(422, "source must be 'original' or 'completed'")
    path = storage.page_image_path(user.id, form.id, page)
    if not path.is_file():
        raise HTTPException(404, "Page image not found")
    return FileResponse(path, media_type="image/png", headers=headers)


@router.get("/{form_id}/download")
def download(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    path = storage.completed_path(user.id, form.id)
    if form.output_at is None or not path.is_file():
        raise HTTPException(404, "The completed PDF has not been generated yet")
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", re.sub(r"\.[A-Za-z0-9]{1,5}$", "", form.original_filename))[:80].strip("._") or "form"
    return FileResponse(path, media_type="application/pdf", filename=f"{stem}-completed.pdf", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


# --------------------------------------------------------------------------- notes (the citizen's own; AI notes come from /schema)
class FormNoteIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class FormNotePatch(BaseModel):
    content: str | None = Field(None, min_length=1, max_length=2000)
    done: bool | None = None


def _note_out(n: FormNote) -> dict:
    return {"id": n.id, "content": n.content, "done": n.done, "created_at": n.created_at.isoformat(), "updated_at": n.updated_at.isoformat()}


@router.get("/{form_id}/notes")
def list_notes(form_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    fields = service.load_fields(db, form) if form.status in ("READY", "COMPLETED") else []
    pages = db.scalars(select(FormPage).where(FormPage.form_id == form.id, FormPage.user_id == user.id)).all()
    values, skipped, blank = service.split_values(service.load_value_rows(db, form))
    notes = db.scalars(select(FormNote).where(FormNote.form_id == form.id, FormNote.user_id == user.id).order_by(FormNote.created_at)).all()
    return {"user_notes": [_note_out(n) for n in notes], "ai_notes": service.ai_notes(form, fields, values, skipped, blank, list(pages), False)}


@router.post("/{form_id}/notes", status_code=201)
def add_note(form_id: str, body: FormNoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = owned_form(db, form_id, user)
    n = FormNote(form_id=form.id, user_id=user.id, content=body.content.strip())
    db.add(n)
    db.commit()
    return _note_out(n)


def _own_note(db: Session, form_id: str, nid: str, user: User) -> FormNote:
    owned_form(db, form_id, user)
    n = db.scalar(select(FormNote).where(FormNote.id == nid, FormNote.form_id == form_id, FormNote.user_id == user.id))
    if n is None:
        raise HTTPException(404, "Note not found")
    return n


@router.patch("/{form_id}/notes/{nid}")
def patch_note(form_id: str, nid: str, body: FormNotePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = _own_note(db, form_id, nid, user)
    if body.content is not None:
        n.content = body.content.strip()
    if body.done is not None:
        n.done = body.done
    db.commit()
    return _note_out(n)


@router.delete("/{form_id}/notes/{nid}")
def delete_note(form_id: str, nid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = _own_note(db, form_id, nid, user)
    db.delete(n)
    db.commit()
    return {"ok": True}
