from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.kag import agent
from app.kag.query_understanding import understand
from app.models import Application, Conversation, Message, User
from app.models.common import utcnow
from app.schemas.common import ChatIn, KagQueryIn
from app.services.query_normalizer import answer_normalized
from app.services.redact import redact
from app.services.reference import ownership_ok, resolve as resolve_reference

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
kag_router = APIRouter(prefix="/api/kag", tags=["kag"])


def _msg_out(m: Message) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "evidence": m.evidence or [], "meta": m.meta or {},
            "created_at": m.created_at.isoformat()}


def _state_code(user: User) -> str | None:
    st = (user.profile or {}).get("state", "")
    return "KA" if st.lower().startswith("karnataka") else None


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.get(Conversation, body.conversation_id) if body.conversation_id else None
    if conv and conv.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    lang = body.language or user.preferred_language or "en"
    context_schemes: list[str] = []
    if body.application_id:
        app = db.get(Application, body.application_id)
        if app and app.user_id == user.id:
            context_schemes = [app.scheme_code]
    if not conv:
        conv = Conversation(user_id=user.id, kind="assistant", language=lang, title=body.message[:80],
                            application_id=body.application_id)
        db.add(conv)
        db.flush()
    history_msgs = db.scalars(select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).limit(6)).all()[::-1]
    history = "\n".join(f"{m.role}: {m.content[:400]}" for m in history_msgs)
    last_scheme_ctx = next((m.meta.get("schemes") for m in reversed(history_msgs) if m.role == "assistant" and m.meta.get("schemes")), None)

    q = understand(body.message, lang, context_schemes or last_scheme_ctx or None, _state_code(user))
    q.language = lang
    db.add(Message(conversation_id=conv.id, role="user", content=redact(body.message), meta={"language": lang, "input_mode": body.input_mode}))

    ref = None
    if body.reference_message_id:
        if not ownership_ok(body.reference_message_id, user.id, db):
            raise HTTPException(403, "Reference not found")
        ref = resolve_reference(body.reference_message_id, body.reference_text, db)
    elif body.reference_text:
        ref = resolve_reference(None, body.reference_text, db)

    prev = next((m for m in reversed(history_msgs) if m.role == "assistant"), None)
    result = answer_normalized(db, body.message, lang, query=q, history=history,
                               input_mode=body.input_mode,
                               extra_context=ref.context if ref else "",
                               extra_query=ref.topic if ref else "",
                               previous_evidence=(prev.evidence or []) if prev else [])

    reply = Message(conversation_id=conv.id, role="assistant", content=result["answer"], evidence=result["evidence"],
                    meta={"grounded": result["grounded"], "insufficient_evidence": result["insufficient_evidence"], "mode": result["mode"],
                          "understanding": result["understanding"], "scheme_cards": result["schemes"],
                          "schemes": [s["code"] for s in result["schemes"]] or last_scheme_ctx or [],
                          "retrieved_count": len(result.get("retrieved", []))})
    db.add(reply)
    conv.updated_at = utcnow()
    db.commit()
    out = {"conversation_id": conv.id, "message": _msg_out(reply), "retrieved": result.get("retrieved", [])}
    if result.get("form_offer"):
        out["form_offer"] = True
    return out


@router.get("/conversations")
def conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).limit(30)).all()
    return [{"id": c.id, "title": c.title, "kind": c.kind, "language": c.language, "application_id": c.application_id,
             "updated_at": c.updated_at.isoformat()} for c in rows]


@router.get("/conversations/{cid}")
def conversation(cid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.get(Conversation, cid)
    if not conv or conv.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    msgs = db.scalars(select(Message).where(Message.conversation_id == cid).order_by(Message.created_at)).all()
    return {"id": conv.id, "title": conv.title, "language": conv.language, "kind": conv.kind, "messages": [_msg_out(m) for m in msgs]}


@kag_router.post("/query")
def kag_query(body: KagQueryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Transparent KAG endpoint: shows understanding, graph facts, ranked evidence and the grounded answer."""
    lang = body.language or user.preferred_language
    q = understand(body.question, lang, None, _state_code(user))
    if body.generate:
        return agent.answer(db, body.question, lang, query=q)
    from app.kag.retriever import retrieve

    r = retrieve(db, q)
    return {"understanding": q.as_dict(), "retrieved": [e.as_dict() for e in [*r.facts, *r.chunks]], "retrieval": r.debug}
