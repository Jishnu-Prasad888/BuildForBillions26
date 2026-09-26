"""Shared KAG conversation turns for Telegram and WhatsApp."""
from __future__ import annotations

from sqlalchemy import select

from app.bot.copy import LANGS
from app.database.session import SessionLocal
from app.graph import get_graph
from app.kag import agent
from app.kag.lang import detect_language
from app.kag.templates import localized_name
from app.models import Conversation, Message, User
from app.models.common import utcnow
from app.services.redact import redact

HISTORY_TURNS = 6
MAX_QUESTION_CHARS = 1500

_CHANNELS = {
    "telegram": {"field": "telegram_id", "email": "tg_{id}@telegram.local", "name": "Telegram User"},
    "whatsapp": {"field": "whatsapp_id", "email": "wa_{id}@whatsapp.local", "name": "WhatsApp User"},
}


def _cfg(channel: str) -> dict:
    if channel not in _CHANNELS:
        raise ValueError(f"Unknown bot channel: {channel}")
    return _CHANNELS[channel]


def _lookup_user(db, channel: str, platform_id: str) -> User | None:
    col = getattr(User, _cfg(channel)["field"])
    return db.scalar(select(User).where(col == platform_id))


def get_or_create_user(channel: str, platform_id: str, name: str, language_code: str | None = None) -> str:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        if not user:
            cfg = _cfg(channel)
            tg_lang = (language_code or "").split("-")[0]
            kwargs = {
                "email": cfg["email"].format(id=platform_id),
                "full_name": (name or "").strip() or cfg["name"],
                "password_hash": "",
                "preferred_language": tg_lang if tg_lang in LANGS else "en",
                cfg["field"]: platform_id,
            }
            user = User(**kwargs)
            db.add(user)
            db.commit()
        return user.preferred_language or "en"
    finally:
        db.close()


def set_language(channel: str, platform_id: str, lang: str) -> None:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        if user:
            user.preferred_language = lang
            db.commit()
    finally:
        db.close()


def get_user_language(channel: str, platform_id: str) -> str:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        return (user.preferred_language if user else None) or "en"
    finally:
        db.close()


def _latest_conversation(db, user_id: str, channel: str) -> Conversation | None:
    return db.scalar(
        select(Conversation)
        .where(Conversation.user_id == user_id, Conversation.kind == channel)
        .order_by(Conversation.updated_at.desc())
    )


def start_new_conversation(channel: str, platform_id: str) -> None:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        if user:
            db.add(Conversation(user_id=user.id, kind=channel, language=user.preferred_language or "en",
                                title="New conversation", state={}))
            db.commit()
    finally:
        db.close()


def get_last_evidence(channel: str, platform_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        conv = _latest_conversation(db, user.id, channel) if user else None
        if not conv:
            return []
        msgs = db.scalars(
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "assistant")
            .order_by(Message.created_at.desc()).limit(HISTORY_TURNS)
        ).all()
        return next((m.evidence for m in msgs if m.evidence), [])
    finally:
        db.close()


def get_evidence_by_message_id(channel: str, platform_id: str, message_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        col = getattr(User, _cfg(channel)["field"])
        row = db.execute(
            select(Message.evidence)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .join(User, Conversation.user_id == User.id)
            .where(Message.id == message_id, col == platform_id)
        ).first()
        return (row[0] or []) if row else []
    finally:
        db.close()


def resolve_language(preferred: str, text: str) -> str:
    detected = detect_language(text, preferred)
    return detected if detected != "en" else preferred


def process_message(channel: str, platform_id: str, text: str, focus_scheme: str | None = None) -> dict:
    db = SessionLocal()
    try:
        user = _lookup_user(db, channel, platform_id)
        if not user:
            return {"error": "User not found"}

        lang = resolve_language(user.preferred_language or "en", text)
        conv = _latest_conversation(db, user.id, channel)
        conv_state: dict = dict(conv.state or {}) if conv else {}
        history_msgs = db.scalars(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc()).limit(HISTORY_TURNS)
        ).all()[::-1] if conv else []

        history = "\n".join(f"{m.role}: {m.content[:400]}" for m in history_msgs)
        prev_reply = next((m for m in reversed(history_msgs) if m.role == "assistant"), None)
        context_schemes = [focus_scheme] if focus_scheme else (conv_state.get("schemes") or None)

        if not conv:
            conv = Conversation(user_id=user.id, kind=channel, language=lang, title=text[:80], state={})
            db.add(conv)
            db.flush()
        elif not history_msgs:
            conv.title = text[:80]

        result = agent.answer(
            db, text, lang,
            context_schemes=context_schemes, state=conv_state.get("state_code"), history=history,
            channel=channel, previous_evidence=(prev_reply.evidence or []) if prev_reply else [],
        )

        understanding = result.get("understanding") or {}
        if understanding.get("life_event"):
            conv_state["life_event"] = understanding["life_event"]["code"]
        if understanding.get("state"):
            conv_state["state_code"] = understanding["state"]
        if result.get("schemes") and not focus_scheme and not understanding.get("from_context"):
            conv_state["schemes"] = [s["code"] for s in result["schemes"]]
        conv.state = conv_state
        conv.language = lang
        conv.updated_at = utcnow()

        db.add(Message(conversation_id=conv.id, role="user", content=redact(text), meta={"language": lang, "channel": channel}))
        reply_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=result["answer"],
            evidence=result["evidence"],
            meta={
                "grounded": result["grounded"],
                "insufficient_evidence": result["insufficient_evidence"],
                "mode": result["mode"],
                "understanding": understanding,
                "scheme_cards": result["schemes"],
                "schemes": [s["code"] for s in result["schemes"]],
                "channel": channel,
            },
        )
        db.add(reply_msg)
        db.commit()

        return {
            "answer": result["answer"],
            "evidence": result["evidence"],
            "schemes": result["schemes"],
            "language": lang,
            "message_id": reply_msg.id,
            "intent": understanding.get("intent"),
            "insufficient": result["insufficient_evidence"],
        }
    finally:
        db.close()


def scheme_info(code: str) -> dict | None:
    s = get_graph().get_scheme(code)
    if not s:
        return None
    portal = s.get("portal") or {}
    return {
        "code": code,
        "name_en": localized_name(s, "en"),
        "summary": s.get("summary") or "",
        "benefit": s.get("benefit") or "",
        "department": (s.get("department") or {}).get("name") or "",
        "portal_name": portal.get("name") or "",
        "portal_url": portal.get("url") or "",
        "short_name": s.get("short_name") or localized_name(s, "en"),
        "scheme": s,
    }


def localized_scheme_name(scheme: dict, lang: str) -> str:
    return localized_name(scheme, lang)
