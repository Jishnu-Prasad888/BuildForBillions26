"""Telegram bot handlers: commands, messages, and callbacks."""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from app.bot.formatter import format_evidence_detail, format_sources, kag_to_html
from app.bot.keyboards import evidence_keyboard, language_keyboard
from app.database.session import SessionLocal
from app.kag import agent
from app.models import Conversation, Message, User
from app.models.common import utcnow
from app.services.redact import redact

log = logging.getLogger("bot")

LANG_LABELS = {"en": "English 🇬🇧", "hi": "हिन्दी 🇮🇳", "kn": "ಕನ್ನಡ 🇮🇳"}

WELCOME = {
    "en": (
        "👋 <b>Welcome to Sahayak!</b>\n\n"
        "I help citizens discover Indian government schemes that may apply to your situation.\n\n"
        "Simply describe your situation in your own words. For example:\n"
        "<i>\"Heavy rain destroyed my crop.\"</i>\n\n"
        "I can help you find:\n"
        "• Relevant government schemes\n"
        "• Eligibility requirements\n"
        "• Required documents\n"
        "• Application information\n"
        "• Official sources\n\n"
        "Every answer is grounded in official sources. Use /language to switch languages."
    ),
    "hi": (
        "👋 <b>सहायक में आपका स्वागत है!</b>\n\n"
        "अपनी स्थिति अपने शब्दों में बताएं। उदाहरण:\n"
        "<i>\"भारी बारिश से मेरी फसल नष्ट हो गई।\"</i>\n\n"
        "भाषा बदलने के लिए /language टाइप करें।"
    ),
    "kn": (
        "👋 <b>ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ!</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ ವಿವರಿಸಿ. ಉದಾಹರಣೆ:\n"
        "<i>\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು.\"</i>\n\n"
        "ಭಾಷೆ ಬದಲಾಯಿಸಲು /language ಟೈಪ್ ಮಾಡಿ."
    ),
}

HELP_TEXT = {
    "en": (
        "ℹ️ <b>How to use Sahayak</b>\n\n"
        "Just describe your situation — I'll identify relevant government schemes.\n\n"
        "<b>Commands:</b>\n"
        "/start — welcome message\n"
        "/help — this help text\n"
        "/language — change language\n"
        "/sources — show sources from last answer\n\n"
        "<b>Example:</b>\n"
        "\"Heavy rain destroyed my paddy crop in Karnataka.\"\n\n"
        "<b>Note:</b> All answers come from official government sources. "
        "Always verify eligibility with the relevant department."
    ),
    "hi": (
        "ℹ️ <b>सहायक का उपयोग कैसे करें</b>\n\n"
        "अपनी स्थिति बताएं — मैं प्रासंगिक सरकारी योजनाएं खोजूंगा।\n\n"
        "कमांड: /start /help /language /sources"
    ),
    "kn": (
        "ℹ️ <b>ಸಹಾಯಕ ಬಳಕೆ</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿ ವಿವರಿಸಿ — ನಾನು ಸಂಬಂಧಿತ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತೇನೆ।\n\n"
        "ಆದೇಶಗಳು: /start /help /language /sources"
    ),
}


# ---------------------------------------------------------------------------
# DB helpers (run in asyncio.to_thread)
# ---------------------------------------------------------------------------

def _get_or_create_user(telegram_id: str, first_name: str, last_name: str) -> User:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if not user:
            full_name = f"{first_name or ''} {last_name or ''}".strip() or "Telegram User"
            user = User(
                email=f"tg_{telegram_id}@telegram.local",
                full_name=full_name,
                password_hash="",
                telegram_id=telegram_id,
                preferred_language="en",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()


def _set_language(telegram_id: str, lang: str) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if user:
            user.preferred_language = lang
            db.commit()
    finally:
        db.close()


def _get_user_language(telegram_id: str) -> str:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        return (user.preferred_language if user else None) or "en"
    finally:
        db.close()


def _get_last_evidence(telegram_id: str) -> list[dict]:
    """Return evidence from the last assistant message for this user."""
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if not user:
            return []
        conv = db.scalar(
            select(Conversation)
            .where(Conversation.user_id == user.id, Conversation.kind == "telegram")
            .order_by(Conversation.updated_at.desc())
        )
        if not conv:
            return []
        msg = db.scalar(
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "assistant")
            .order_by(Message.created_at.desc())
        )
        return msg.evidence or [] if msg else []
    finally:
        db.close()


def _get_evidence_by_message_id(message_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        msg = db.get(Message, message_id)
        return msg.evidence or [] if msg else []
    finally:
        db.close()


def _process_message(telegram_id: str, text: str) -> dict:
    """Core KAG pipeline call. Runs in a thread pool."""
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if not user:
            return {"error": "User not found"}

        lang = user.preferred_language or "en"

        # Find or create active conversation
        conv = db.scalar(
            select(Conversation)
            .where(Conversation.user_id == user.id, Conversation.kind == "telegram")
            .order_by(Conversation.updated_at.desc())
        )
        conv_state: dict = {}
        if conv:
            conv_state = conv.state or {}
            history_msgs = db.scalars(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at.desc())
                .limit(6)
            ).all()[::-1]
        else:
            history_msgs = []

        history = "\n".join(f"{m.role}: {m.content[:400]}" for m in history_msgs)
        context_schemes: list[str] | None = conv_state.get("schemes") or None
        state_code: str | None = conv_state.get("state_code")

        if not conv:
            conv = Conversation(
                user_id=user.id, kind="telegram", language=lang,
                title=text[:80], state={},
            )
            db.add(conv)
            db.flush()

        # KAG
        result = agent.answer(
            db, text, lang,
            context_schemes=context_schemes, state=state_code, history=history,
        )

        # Update conversation state
        understanding = result.get("understanding", {})
        new_state = dict(conv_state)
        if understanding.get("life_event"):
            new_state["life_event"] = understanding["life_event"]["code"] if isinstance(understanding["life_event"], dict) else understanding["life_event"]
        if understanding.get("state"):
            new_state["state_code"] = understanding["state"]
        if result.get("schemes"):
            new_state["schemes"] = [s["code"] for s in result["schemes"]]
        conv.state = new_state
        conv.updated_at = utcnow()

        # Persist messages
        db.add(Message(conversation_id=conv.id, role="user", content=redact(text), meta={"language": lang}))
        reply_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=result["answer"],
            evidence=result["evidence"],
            meta={
                "grounded": result["grounded"],
                "insufficient_evidence": result["insufficient_evidence"],
                "mode": result["mode"],
                "schemes": [s["code"] for s in result["schemes"]],
            },
        )
        db.add(reply_msg)
        db.commit()
        db.refresh(reply_msg)

        return {
            "answer": result["answer"],
            "evidence": result["evidence"],
            "schemes": result["schemes"],
            "language": lang,
            "message_id": reply_msg.id,
            "insufficient": result["insufficient_evidence"],
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    telegram_id = str(tg_user.id)
    user = await asyncio.to_thread(
        _get_or_create_user, telegram_id,
        tg_user.first_name or "", tg_user.last_name or "",
    )
    lang = user.preferred_language or "en"
    text = WELCOME.get(lang, WELCOME["en"])
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id = str(update.effective_user.id)
    lang = await asyncio.to_thread(_get_user_language, telegram_id)
    text = HELP_TEXT.get(lang, HELP_TEXT["en"])
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def cmd_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
        reply_markup=language_keyboard(),
    )


async def cmd_sources(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id = str(update.effective_user.id)
    evidence = await asyncio.to_thread(_get_last_evidence, telegram_id)
    if not evidence:
        await update.message.reply_text("No sources from previous answers yet.")
        return
    text = format_evidence_detail(evidence)
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


# ---------------------------------------------------------------------------
# Text message handler
# ---------------------------------------------------------------------------

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    telegram_id = str(tg_user.id)

    # Ensure user exists
    await asyncio.to_thread(
        _get_or_create_user, telegram_id,
        tg_user.first_name or "", tg_user.last_name or "",
    )

    # Show typing indicator
    await update.message.chat.send_action("typing")

    text = update.message.text or ""
    if not text.strip():
        return

    result = await asyncio.to_thread(_process_message, telegram_id, text)

    if "error" in result:
        await update.message.reply_text("Sorry, something went wrong. Please try /start again.")
        return

    answer_html = kag_to_html(result["answer"])
    sources_html = format_sources(result["evidence"])
    reply_text = answer_html + sources_html

    evidence = result["evidence"]
    if evidence:
        markup = evidence_keyboard(result["message_id"], len(evidence))
        await update.message.reply_text(reply_text, parse_mode=ParseMode.HTML, reply_markup=markup)
    else:
        await update.message.reply_text(reply_text, parse_mode=ParseMode.HTML)


# ---------------------------------------------------------------------------
# Callback query handler
# ---------------------------------------------------------------------------

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data or ""

    if data.startswith("lang:"):
        lang = data[5:]
        if lang in ("en", "hi", "kn"):
            telegram_id = str(update.effective_user.id)
            await asyncio.to_thread(_set_language, telegram_id, lang)
            label = LANG_LABELS.get(lang, lang)
            await query.edit_message_text(f"✅ Language set to {label}")

    elif data.startswith("evidence:"):
        message_id = data[9:]
        evidence = await asyncio.to_thread(_get_evidence_by_message_id, message_id)
        text = format_evidence_detail(evidence)
        await query.message.reply_text(text, parse_mode=ParseMode.HTML)

    elif data.startswith("state:"):
        # User tapped a state button — feed it back as a message
        state_val = data[6:]
        if state_val == "OTHER":
            await query.edit_message_text("Please tell me which state you are in.")
        else:
            label = {"KA": "Karnataka"}.get(state_val, state_val)
            await query.edit_message_text(f"Got it — {label}.")
