from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import Application, Conversation, Message, User
from app.models.common import utcnow
from app.schemas.common import SessionMessage, SessionStart
from app.services.form_assistant import FormAssistant
from app.services.form_templates import f

router = APIRouter(prefix="/api/screen-assistance", tags=["screen-assistance"])


def _load(db: Session, sid: str, user: User) -> tuple[Conversation, Application]:
    conv = db.get(Conversation, sid)
    if not conv or conv.user_id != user.id or conv.kind != "form_assistance":
        raise HTTPException(404, "Session not found")
    app = db.get(Application, conv.application_id)
    return conv, app


@router.post("/sessions", status_code=201)
def start(body: SessionStart, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    app = db.get(Application, body.application_id)
    if not app or app.user_id != user.id:
        raise HTTPException(404, "Application not found")
    if app.status not in ("DRAFT", "IN_PROGRESS", "DOCUMENTS_REQUIRED"):
        raise HTTPException(400, "This application has already been submitted")
    # close previous open sessions for this application, keep their state (hint cache etc.)
    prev_state = {}
    for c in db.scalars(select(Conversation).where(Conversation.application_id == app.id, Conversation.kind == "form_assistance",
                                                   Conversation.ended_at.is_(None))).all():
        c.ended_at = utcnow()
        prev_state = c.state or {}
    conv = Conversation(user_id=user.id, application_id=app.id, kind="form_assistance", language=body.language,
                        title=f"Form assistance – {app.scheme_name}",
                        state={"skipped": prev_state.get("skipped", []), "screen_shared": body.screen_shared})
    db.add(conv)
    db.flush()
    try:
        fa = FormAssistant(db, user, conv, app)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return fa.start(body.screen.model_dump() if body.screen else None)


@router.post("/sessions/{sid}/messages")
def message(sid: str, body: SessionMessage, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv, app = _load(db, sid, user)
    if conv.ended_at:
        raise HTTPException(400, "This assistance session has ended")
    if body.language and body.language != conv.language:
        conv.language = body.language
    fa = FormAssistant(db, user, conv, app)
    return fa.handle(body.text, body.screen.model_dump() if body.screen else None)


@router.post("/sessions/{sid}/end")
def end(sid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv, app = _load(db, sid, user)
    conv.ended_at = utcnow()
    msg = f("ended", conv.language)
    db.add(Message(conversation_id=conv.id, role="system", content=msg))
    db.commit()
    return {"ok": True, "message": msg, "progress": app.progress}


@router.get("/sessions/{sid}")
def get_session(sid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv, app = _load(db, sid, user)
    msgs = db.scalars(select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)).all()
    return {"id": conv.id, "language": conv.language, "ended": bool(conv.ended_at), "current_field": (conv.state or {}).get("current_field"),
            "messages": [{"id": m.id, "role": m.role, "content": m.content, "evidence": m.evidence or [], "meta": m.meta or {}} for m in msgs]}
