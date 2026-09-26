"""AI notes (generated, application-specific) and helpers for user notes."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.graph import get_graph
from app.models import Application, Note, UserDocument
from app.models.common import utcnow
from app.services.forms import all_fields, field_label, is_filled, resolve_field, section_progress, section_title

WALLET_LABELS = {
    "AADHAAR": "Aadhaar", "DRIVING_LICENCE": "Driving Licence", "LAND_RECORD": "Land record (RTC)",
    "BANK": "Bank passbook", "CERTIFICATE": "Certificate", "OTHER": "Other document",
}


def wallet_types(db: Session, user_id: str) -> set[str]:
    return set(db.scalars(select(UserDocument.doc_type).where(UserDocument.user_id == user_id)).all())


def build_ai_notes(db: Session, app: Application, form: dict | None, lang: str = "en", questions: list[str] | None = None) -> dict:
    values = app.form_data or {}
    have = wallet_types(db, app.user_id)
    scheme = get_graph().get_scheme(app.scheme_code)
    docs = []
    for d in (scheme or {}).get("documents", []):
        wt = set(d.get("wallet_types") or [])
        docs.append({"code": d["code"], "name": (d.get("names") or {}).get(lang) or d["name"], "available": bool(wt & have)})
    completed, pending, skipped = [], [], []
    if form:
        for s in section_progress(form, values):
            if s["complete"]:
                completed.append(section_title(s, lang))
        skipped_ids = {k for k, v in (app.field_status or {}).items() if v == "SKIPPED"}
        for fld in all_fields(form):
            fr = resolve_field(fld, values)
            if fld.get("required") and not is_filled(fld, values):
                (skipped if fld["id"] in skipped_ids else pending).append(field_label(fr, lang))
    existing = get_ai_note(db, app)
    prev_q = (existing.data or {}).get("questions", []) if existing else []
    qs = list(dict.fromkeys([*prev_q, *(questions or [])]))[-8:]
    data = {
        "application": app.scheme_name, "status": app.status, "progress": app.progress, "completed": completed,
        "pending": pending, "skipped": skipped, "documents": docs, "questions": qs,
        "last_completed": app.last_completed_section, "next": app.next_section, "language": lang,
        "updated_at": utcnow().isoformat(),
    }
    if existing:
        existing.data = data
        existing.updated_at = utcnow()
    else:
        db.add(Note(user_id=app.user_id, application_id=app.id, kind="AI", item_type="summary", content="", data=data, origin="ai"))
    return data


def get_ai_note(db: Session, app: Application) -> Note | None:
    return db.scalars(select(Note).where(Note.application_id == app.id, Note.kind == "AI")).first()
