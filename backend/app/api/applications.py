import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.notes import note_out
from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.graph import get_graph
from app.kag.agent import scheme_card
from app.models import Application, ApplicationDocument, Conversation, Message, Note, User, UserDocument
from app.models.common import utcnow
from app.schemas.common import ApplicationCreate, FormPatch, SubmitIn
from app.services.forms import all_fields, compute_status, get_form, section_progress
from app.services.notes import build_ai_notes

router = APIRouter(prefix="/api/applications", tags=["applications"])

STATUS_FLOW = ["SUBMITTED", "UNDER_REVIEW", "FIELD_VERIFICATION", "APPROVED"]


def app_out(a: Application) -> dict:
    return {"id": a.id, "scheme_code": a.scheme_code, "scheme_name": a.scheme_name, "form_id": a.form_id, "status": a.status,
            "progress": a.progress, "reference_number": a.reference_number, "last_completed_section": a.last_completed_section,
            "next_section": a.next_section, "timeline": a.timeline or [], "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat(), "demo": settings.DEMO_MODE}


def _own(db: Session, aid: str, user: User) -> Application:
    a = db.get(Application, aid)
    if not a or a.user_id != user.id:
        raise HTTPException(404, "Application not found")
    return a


@router.get("")
def list_apps(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc())).all()
    return [app_out(a) for a in rows]


@router.post("", status_code=201)
def create_app(body: ApplicationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_graph().get_scheme(body.scheme_code)
    if not s:
        raise HTTPException(404, "Scheme not found")
    existing = db.scalars(select(Application).where(Application.user_id == user.id, Application.scheme_code == s["code"],
                                                    Application.status.in_(["DRAFT", "IN_PROGRESS", "DOCUMENTS_REQUIRED"]))).first()
    if existing:
        return {**app_out(existing), "existing": True}
    form = get_form(s.get("form_id"))
    a = Application(user_id=user.id, scheme_code=s["code"], scheme_name=s.get("short_name") or s["name"], form_id=s.get("form_id"),
                    status="IN_PROGRESS" if form else "DRAFT", evidence=body.evidence[:20],
                    timeline=[{"status": "CREATED", "at": utcnow().isoformat(), "note": "Application started from the assistant"}])
    if form:
        a.field_status, a.progress = compute_status(form, {})
        a.next_section = form["sections"][0]["title"]
    db.add(a)
    db.flush()
    build_ai_notes(db, a, form, user.preferred_language)
    db.commit()
    return app_out(a)


@router.get("/{aid}")
def get_app(aid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _own(db, aid, user)
    form = get_form(a.form_id)
    s = get_graph().get_scheme(a.scheme_code)
    docs = db.execute(select(ApplicationDocument, UserDocument).join(UserDocument, ApplicationDocument.user_document_id == UserDocument.id)
                      .where(ApplicationDocument.application_id == a.id)).all()
    notes = db.scalars(select(Note).where(Note.user_id == user.id, (Note.application_id == a.id) | (Note.application_id.is_(None)))
                       .order_by(Note.position)).all()
    convs = db.scalars(select(Conversation).where(Conversation.application_id == a.id).order_by(Conversation.created_at)).all()
    msgs = db.scalars(select(Message).where(Message.conversation_id.in_([c.id for c in convs])).order_by(Message.created_at)).all() if convs else []
    evidence, seen = list(a.evidence or []), {e.get("id") for e in (a.evidence or [])}
    for m in msgs:
        for e in m.evidence or []:
            if e.get("id") not in seen:
                seen.add(e.get("id"))
                evidence.append(e)
    wallet = db.scalars(select(UserDocument).where(UserDocument.user_id == user.id)).all()
    return {
        **app_out(a),
        "form_data": a.form_data or {}, "field_status": a.field_status or {},
        "form": form, "sections": section_progress(form, a.form_data or {}) if form else [],
        "scheme": scheme_card(s, user.preferred_language) if s else None,
        "documents": [{"id": ad.id, "requirement_code": ad.requirement_code, "user_document": {"id": ud.id, "title": ud.title, "doc_type": ud.doc_type}} for ad, ud in docs],
        "wallet": [{"id": w.id, "title": w.title, "doc_type": w.doc_type} for w in wallet],
        "ai_notes": next((note_out(n) for n in notes if n.kind == "AI" and n.application_id == a.id), None),
        "user_notes": [note_out(n) for n in notes if n.kind == "USER"],
        "evidence": evidence,
        "conversation": [{"id": m.id, "role": m.role, "content": m.content, "evidence": m.evidence or [], "created_at": m.created_at.isoformat(),
                          "session": m.conversation_id} for m in msgs],
        "active_session_id": next((c.id for c in reversed(convs) if c.kind == "form_assistance" and not c.ended_at), None),
    }


@router.patch("/{aid}/form")
def patch_form(aid: str, body: FormPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Manual edits made directly in the form by the citizen."""
    a = _own(db, aid, user)
    if a.status not in ("DRAFT", "IN_PROGRESS", "DOCUMENTS_REQUIRED"):
        raise HTTPException(400, "Submitted applications cannot be edited")
    form = get_form(a.form_id)
    if not form:
        raise HTTPException(400, "No form for this application")
    ids = {f["id"] for f in all_fields(form)}
    vals = dict(a.form_data or {})
    for k, v in body.values.items():
        if k in ids:
            if isinstance(v, str) and len(v) > 500:
                raise HTTPException(422, f"Value too long for {k}")
            vals[k] = v
    skipped = {k for k, v in (a.field_status or {}).items() if v == "SKIPPED"}
    a.form_data = vals
    a.field_status, a.progress = compute_status(form, vals, skipped)
    for s in form["sections"]:
        if all(vals.get(f["id"]) not in (None, "", False) for f in s["fields"]):
            a.last_completed_section = s["title"]
    build_ai_notes(db, a, form, user.preferred_language)
    db.commit()
    return {"form_data": a.form_data, "field_status": a.field_status, "progress": a.progress}


@router.post("/{aid}/submit")
def submit(aid: str, body: SubmitIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _own(db, aid, user)
    if not body.confirm:
        raise HTTPException(400, "Explicit confirmation is required to submit")
    if a.status in STATUS_FLOW:
        raise HTTPException(400, "Already submitted")
    form = get_form(a.form_id)
    if form:
        _, progress = compute_status(form, a.form_data or {})
        if progress < 100:
            raise HTTPException(400, "Please complete all required fields before submitting")
    a.status = "SUBMITTED"
    a.progress = 100
    a.submitted_at = utcnow()
    a.reference_number = f"DEMO-{a.scheme_code[:3]}-{utcnow().year}-{random.randint(1000, 9999)}"
    a.timeline = [*(a.timeline or []), {"status": "SUBMITTED", "at": utcnow().isoformat(),
                                        "note": "DEMO submission recorded in this prototype only. Nothing was sent to a government portal."}]
    build_ai_notes(db, a, form, user.preferred_language)
    for c in db.scalars(select(Conversation).where(Conversation.application_id == a.id, Conversation.ended_at.is_(None))).all():
        c.ended_at = utcnow()
    db.commit()
    return app_out(a)


@router.post("/{aid}/simulate-status")
def simulate(aid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """DEMO MODE ONLY: advance the mock status so the tracker can be demonstrated."""
    if not settings.DEMO_MODE:
        raise HTTPException(403, "Only available in demo mode")
    a = _own(db, aid, user)
    if a.status not in STATUS_FLOW or a.status == STATUS_FLOW[-1]:
        raise HTTPException(400, "Nothing to advance")
    nxt = STATUS_FLOW[STATUS_FLOW.index(a.status) + 1]
    a.status = nxt
    a.timeline = [*(a.timeline or []), {"status": nxt, "at": utcnow().isoformat(), "note": "Simulated status update (demo)"}]
    db.commit()
    return app_out(a)


@router.post("/{aid}/documents")
def attach_document(aid: str, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _own(db, aid, user)
    ud = db.get(UserDocument, str(body.get("user_document_id", "")))
    if not ud or ud.user_id != user.id:
        raise HTTPException(404, "Document not found")
    ad = ApplicationDocument(application_id=a.id, user_document_id=ud.id, requirement_code=(body.get("requirement_code") or None))
    db.add(ad)
    build_ai_notes(db, a, get_form(a.form_id), user.preferred_language)
    db.commit()
    return {"id": ad.id}
