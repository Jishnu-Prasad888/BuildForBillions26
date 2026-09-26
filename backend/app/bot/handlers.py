"""Telegram bot handlers: commands, messages, and callbacks.

Every text message goes through the same KAG pipeline as the web assistant
(``agent.answer`` with ``channel="telegram"``). Blocking work (DB, retrieval, LLM)
runs in a thread; a per-user lock keeps one user's messages in order while other
users are served concurrently.
"""
from __future__ import annotations

import asyncio
import contextlib
import html
import logging
import re
from collections import defaultdict

from sqlalchemy import select
from telegram import Message as TgMessage
from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from app.bot.formatter import format_evidence_detail, format_sources, kag_to_html, split_message
from app.bot.keyboards import answer_keyboard, language_keyboard, scheme_keyboard
from app.database.session import SessionLocal
from app.graph import get_graph
from app.kag import agent
from app.kag.lang import detect_language
from app.kag.templates import localized_name
from app.models import Conversation, Message, User
from app.models.common import utcnow
from app.services.redact import redact

log = logging.getLogger("bot")

LANGS = ("en", "hi", "kn")
LANG_LABELS = {"en": "English 🇬🇧", "hi": "हिन्दी 🇮🇳", "kn": "ಕನ್ನಡ 🇮🇳"}
HISTORY_TURNS = 6

WELCOME = {
    "en": (
        "👋 <b>Welcome to Sahayak!</b>\n\n"
        "I help you find Indian government schemes that fit your situation.\n\n"
        "Describe what happened in your own words, for example:\n"
        "<i>\"Heavy rain destroyed my crop.\"</i>\n\n"
        "You can also ask:\n"
        "• <i>What documents do I need for PM-KISAN?</i>\n"
        "• <i>How much money does PM-KISAN give?</i>\n"
        "• <i>How do I claim crop insurance?</i>\n\n"
        "Every answer is grounded in official sources — tap <b>📚 Sources</b> to read them.\n"
        "/language to switch language · /new to start over · /help for more."
    ),
    "hi": (
        "👋 <b>सहायक में आपका स्वागत है!</b>\n\n"
        "मैं आपकी स्थिति के अनुसार सरकारी योजनाएँ खोजने में मदद करता हूँ।\n\n"
        "अपने शब्दों में बताइए क्या हुआ, जैसे:\n"
        "<i>\"भारी बारिश से मेरी फसल नष्ट हो गई।\"</i>\n\n"
        "आप यह भी पूछ सकते हैं:\n"
        "• <i>PM-KISAN के लिए कौन से दस्तावेज़ चाहिए?</i>\n"
        "• <i>फसल बीमा का दावा कैसे करें?</i>\n\n"
        "हर उत्तर आधिकारिक स्रोतों पर आधारित है — <b>📚 स्रोत</b> पर टैप करें।\n"
        "/language भाषा बदलें · /new नई बातचीत · /help मदद"
    ),
    "kn": (
        "👋 <b>ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ!</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\n\n"
        "ಏನಾಯಿತು ಎಂದು ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ ಹೇಳಿ, ಉದಾಹರಣೆ:\n"
        "<i>\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು.\"</i>\n\n"
        "ನೀವು ಇದನ್ನೂ ಕೇಳಬಹುದು:\n"
        "• <i>PM-KISAN ಗೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?</i>\n"
        "• <i>ಬೆಳೆ ವಿಮೆ ಕ್ಲೈಮ್ ಹೇಗೆ ಮಾಡುವುದು?</i>\n\n"
        "ಪ್ರತಿ ಉತ್ತರ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಆಧರಿಸಿದೆ — <b>📚 ಮೂಲಗಳು</b> ಟ್ಯಾಪ್ ಮಾಡಿ.\n"
        "/language ಭಾಷೆ · /new ಹೊಸ ಸಂಭಾಷಣೆ · /help ಸಹಾಯ"
    ),
}

HELP_TEXT = {
    "en": (
        "ℹ️ <b>How to use Sahayak</b>\n\n"
        "Describe your situation or ask a question in English, Hindi or Kannada. "
        "I remember the last few messages, so you can ask follow-ups like <i>\"how do I apply for it?\"</i>\n\n"
        "Tap a scheme button under an answer to see its documents, eligibility, benefit and how to apply.\n\n"
        "<b>Commands</b>\n"
        "/start — welcome message\n"
        "/help — this help\n"
        "/language — change language\n"
        "/new — start a new conversation\n"
        "/sources — sources behind the last answer\n\n"
        "<b>Note:</b> answers come from official sources, but always confirm eligibility with the department before you apply."
    ),
    "hi": (
        "ℹ️ <b>सहायक का उपयोग कैसे करें</b>\n\n"
        "अपनी स्थिति बताइए या हिन्दी, अंग्रेज़ी या कन्नड़ में सवाल पूछिए। मुझे पिछले कुछ संदेश याद रहते हैं, "
        "इसलिए आप पूछ सकते हैं <i>\"इसके लिए आवेदन कैसे करें?\"</i>\n\n"
        "किसी उत्तर के नीचे योजना बटन पर टैप करके दस्तावेज़, पात्रता, लाभ और आवेदन का तरीका देखें।\n\n"
        "<b>कमांड</b>\n"
        "/start — स्वागत संदेश\n/help — मदद\n/language — भाषा बदलें\n/new — नई बातचीत\n/sources — पिछले उत्तर के स्रोत"
    ),
    "kn": (
        "ℹ️ <b>ಸಹಾಯಕ ಬಳಕೆ</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿ ವಿವರಿಸಿ ಅಥವಾ ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ. ಕೊನೆಯ ಕೆಲವು ಸಂದೇಶಗಳು ನನಗೆ ನೆನಪಿರುತ್ತವೆ, "
        "ಆದ್ದರಿಂದ <i>\"ಇದಕ್ಕೆ ಅರ್ಜಿ ಹೇಗೆ?\"</i> ಎಂದು ಕೇಳಬಹುದು.\n\n"
        "ಉತ್ತರದ ಕೆಳಗಿನ ಯೋಜನೆ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ ದಾಖಲೆಗಳು, ಅರ್ಹತೆ, ಪ್ರಯೋಜನ ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ ನೋಡಿ.\n\n"
        "<b>ಆದೇಶಗಳು</b>\n"
        "/start — ಸ್ವಾಗತ\n/help — ಸಹಾಯ\n/language — ಭಾಷೆ ಬದಲಿಸಿ\n/new — ಹೊಸ ಸಂಭಾಷಣೆ\n/sources — ಹಿಂದಿನ ಉತ್ತರದ ಮೂಲಗಳು"
    ),
}

UI = {
    "error": {
        "en": "😔 Sorry, something went wrong while answering. Please try again in a moment.",
        "hi": "😔 क्षमा करें, उत्तर देते समय कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद फिर कोशिश करें।",
        "kn": "😔 ಕ್ಷಮಿಸಿ, ಉತ್ತರಿಸುವಾಗ ತೊಂದರೆಯಾಯಿತು. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    },
    "text_only": {
        "en": "I can only read text messages for now. Please type your question.",
        "hi": "अभी मैं केवल लिखे हुए संदेश पढ़ सकता हूँ। कृपया अपना सवाल लिखें।",
        "kn": "ಸದ್ಯ ನಾನು ಬರಹದ ಸಂದೇಶಗಳನ್ನು ಮಾತ್ರ ಓದಬಲ್ಲೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.",
    },
    "too_long": {
        "en": "That message is very long. Please describe your question in a few sentences.",
        "hi": "संदेश बहुत लंबा है। कृपया अपना सवाल कुछ वाक्यों में लिखें।",
        "kn": "ಸಂದೇಶ ತುಂಬಾ ಉದ್ದವಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕೆಲವು ವಾಕ್ಯಗಳಲ್ಲಿ ಬರೆಯಿರಿ.",
    },
    "new_chat": {
        "en": "🆕 Started a new conversation. Tell me what happened or ask about a scheme.",
        "hi": "🆕 नई बातचीत शुरू हुई। बताइए क्या हुआ या किसी योजना के बारे में पूछिए।",
        "kn": "🆕 ಹೊಸ ಸಂಭಾಷಣೆ ಆರಂಭವಾಯಿತು. ಏನಾಯಿತು ಎಂದು ಹೇಳಿ ಅಥವಾ ಯೋಜನೆಯ ಬಗ್ಗೆ ಕೇಳಿ.",
    },
    "no_sources": {
        "en": "There are no sources yet. Ask me a question first.",
        "hi": "अभी कोई स्रोत नहीं है। पहले कोई सवाल पूछिए।",
        "kn": "ಇನ್ನೂ ಯಾವುದೇ ಮೂಲಗಳಿಲ್ಲ. ಮೊದಲು ಪ್ರಶ್ನೆ ಕೇಳಿ.",
    },
    "lang_set": {"en": "✅ Language set to {label}", "hi": "✅ भाषा {label} चुनी गई", "kn": "✅ ಭಾಷೆ {label} ಆಯ್ಕೆಯಾಗಿದೆ"},
    "choose_lang": {
        "en": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
        "hi": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
        "kn": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
    },
    "scheme_missing": {
        "en": "I couldn't find that scheme any more. Please ask your question again.",
        "hi": "यह योजना अब नहीं मिली। कृपया अपना सवाल फिर से पूछें।",
        "kn": "ಆ ಯೋಜನೆ ಈಗ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಿ.",
    },
    "benefit": {"en": "Benefit", "hi": "लाभ", "kn": "ಪ್ರಯೋಜನ"},
    "department": {"en": "Department", "hi": "विभाग", "kn": "ಇಲಾಖೆ"},
    "portal": {"en": "Apply at", "hi": "आवेदन", "kn": "ಅರ್ಜಿ"},
    "scheme_hint": {
        "en": "What would you like to know?",
        "hi": "आप क्या जानना चाहेंगे?",
        "kn": "ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?",
    },
    "demo": {
        "en": "DEMO summary — confirm on the official portal.",
        "hi": "डेमो सारांश — आधिकारिक पोर्टल पर पुष्टि करें।",
        "kn": "ಡೆಮೊ ಸಾರಾಂಶ — ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ದೃಢೀಕರಿಸಿ.",
    },
}

# Follow-up questions asked by the scheme buttons, phrased so query understanding picks the right intent.
ASK = {
    "documents": {
        "en": "What documents do I need for {name}?",
        "hi": "{name} के लिए कौन से दस्तावेज़ चाहिए?",
        "kn": "{name} ಗೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?",
    },
    "eligibility": {
        "en": "Who is eligible for {name}?",
        "hi": "{name} के लिए कौन पात्र है?",
        "kn": "{name} ಗೆ ಯಾರು ಅರ್ಹರು?",
    },
    "how_to_apply": {
        "en": "How do I apply for {name}?",
        "hi": "{name} के लिए आवेदन कैसे करें?",
        "kn": "{name} ಗೆ ಅರ್ಜಿ ಹೇಗೆ ಸಲ್ಲಿಸುವುದು?",
    },
    "amount": {
        "en": "How much money will I get under {name}?",
        "hi": "{name} में कितना पैसा मिलेगा?",
        "kn": "{name} ಅಡಿಯಲ್ಲಿ ಎಷ್ಟು ಹಣ ಸಿಗುತ್ತದೆ?",
    },
}

MAX_QUESTION_CHARS = 1500

_user_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def ui(key: str, lang: str, **kw) -> str:
    entry = UI[key]
    s = entry.get(lang) or entry["en"]
    return s.format(**kw) if kw else s


# ---------------------------------------------------------------------------
# DB helpers (run in asyncio.to_thread)
# ---------------------------------------------------------------------------

def _get_or_create_user(telegram_id: str, first_name: str, last_name: str, language_code: str | None = None) -> str:
    """Ensure a User row exists for this Telegram account; returns the preferred language."""
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if not user:
            full_name = f"{first_name or ''} {last_name or ''}".strip() or "Telegram User"
            tg_lang = (language_code or "").split("-")[0]
            user = User(
                email=f"tg_{telegram_id}@telegram.local",
                full_name=full_name,
                password_hash="",
                telegram_id=telegram_id,
                preferred_language=tg_lang if tg_lang in LANGS else "en",
            )
            db.add(user)
            db.commit()
        return user.preferred_language or "en"
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


def _latest_conversation(db, user_id: str) -> Conversation | None:
    return db.scalar(
        select(Conversation)
        .where(Conversation.user_id == user_id, Conversation.kind == "telegram")
        .order_by(Conversation.updated_at.desc())
    )


def _start_new_conversation(telegram_id: str) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if user:
            db.add(Conversation(user_id=user.id, kind="telegram", language=user.preferred_language or "en",
                                title="New conversation", state={}))
            db.commit()
    finally:
        db.close()


def _get_last_evidence(telegram_id: str) -> list[dict]:
    """Return evidence from the last assistant message that had any."""
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        conv = _latest_conversation(db, user.id) if user else None
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


def _get_evidence_by_message_id(telegram_id: str, message_id: str) -> list[dict]:
    """Evidence of one assistant message, only if it belongs to this Telegram user."""
    db = SessionLocal()
    try:
        row = db.execute(
            select(Message.evidence)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .join(User, Conversation.user_id == User.id)
            .where(Message.id == message_id, User.telegram_id == telegram_id)
        ).first()
        return (row[0] or []) if row else []
    finally:
        db.close()


def _resolve_language(preferred: str, text: str) -> str:
    """Reply in the script the citizen typed (Hindi/Kannada); English text keeps the chosen language,
    so a Hindi speaker typing "PM Kisan" still gets a Hindi answer."""
    detected = detect_language(text, preferred)
    return detected if detected != "en" else preferred


def _process_message(telegram_id: str, text: str, focus_scheme: str | None = None) -> dict:
    """Run one turn through the KAG pipeline and persist it. Runs in a worker thread."""
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.telegram_id == telegram_id))
        if not user:
            return {"error": "User not found"}

        lang = _resolve_language(user.preferred_language or "en", text)
        conv = _latest_conversation(db, user.id)
        conv_state: dict = dict(conv.state or {}) if conv else {}
        history_msgs = db.scalars(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc()).limit(HISTORY_TURNS)
        ).all()[::-1] if conv else []

        history = "\n".join(f"{m.role}: {m.content[:400]}" for m in history_msgs)
        prev_reply = next((m for m in reversed(history_msgs) if m.role == "assistant"), None)
        context_schemes = [focus_scheme] if focus_scheme else (conv_state.get("schemes") or None)

        if not conv:
            conv = Conversation(user_id=user.id, kind="telegram", language=lang, title=text[:80], state={})
            db.add(conv)
            db.flush()
        elif not history_msgs:
            conv.title = text[:80]

        result = agent.answer(
            db, text, lang,
            context_schemes=context_schemes, state=conv_state.get("state_code"), history=history,
            channel="telegram", previous_evidence=(prev_reply.evidence or []) if prev_reply else [],
        )

        understanding = result.get("understanding") or {}
        if understanding.get("life_event"):
            conv_state["life_event"] = understanding["life_event"]["code"]
        if understanding.get("state"):
            conv_state["state_code"] = understanding["state"]
        if result.get("schemes") and not focus_scheme and not understanding.get("from_context"):
            # a follow-up about one scheme should not narrow the scheme list the citizen can ask about
            conv_state["schemes"] = [s["code"] for s in result["schemes"]]
        conv.state = conv_state
        conv.language = lang
        conv.updated_at = utcnow()

        db.add(Message(conversation_id=conv.id, role="user", content=redact(text), meta={"language": lang, "channel": "telegram"}))
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
                "channel": "telegram",
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


def _scheme_card_html(code: str, lang: str) -> str | None:
    s = get_graph().get_scheme(code)
    if not s:
        return None
    lines = [f"<b>{html.escape(localized_name(s, lang))}</b>"]
    if s.get("summary"):
        lines.append(html.escape(s["summary"]))
    lines.append("")
    if s.get("benefit"):
        lines.append(f"💰 <b>{ui('benefit', lang)}:</b> {html.escape(s['benefit'])}")
    dept = (s.get("department") or {}).get("name")
    if dept:
        lines.append(f"🏛 <b>{ui('department', lang)}:</b> {html.escape(dept)}")
    portal = s.get("portal") or {}
    if portal.get("name"):
        url = portal.get("url") or ""
        link = (f'<a href="{html.escape(url, quote=True)}">{html.escape(portal["name"])}</a>'
                if url.startswith(("http://", "https://")) else html.escape(portal["name"]))
        lines.append(f"🌐 <b>{ui('portal', lang)}:</b> {link}")
    lines += ["", f"<i>{ui('demo', lang)}</i>", "", ui("scheme_hint", lang)]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Sending helpers
# ---------------------------------------------------------------------------

@contextlib.asynccontextmanager
async def _typing(msg: TgMessage):
    """Keep the "typing…" indicator alive while a slow LLM call runs (Telegram clears it after ~5 s)."""
    async def loop() -> None:
        while True:
            with contextlib.suppress(Exception):
                await msg.chat.send_action(ChatAction.TYPING)
            await asyncio.sleep(4)

    task = asyncio.create_task(loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


async def _send_html(msg: TgMessage, text: str, reply_markup=None, quote: bool = True) -> None:
    """Send possibly-long HTML in several messages; the keyboard goes on the last one.
    Falls back to plain text if Telegram rejects the markup."""
    chunks = split_message(text)
    for i, chunk in enumerate(chunks):
        markup = reply_markup if i == len(chunks) - 1 else None
        try:
            await msg.reply_text(chunk, parse_mode=ParseMode.HTML, reply_markup=markup,
                                 disable_web_page_preview=True, do_quote=quote and i == 0)
        except BadRequest as exc:
            log.warning("Telegram rejected HTML (%s); sending plain text", exc)
            plain = html.unescape(re.sub(r"<[^>]+>", "", chunk))
            await msg.reply_text(plain, reply_markup=markup, disable_web_page_preview=True)


async def _answer(msg: TgMessage, telegram_id: str, text: str, focus_scheme: str | None = None,
                  echo_question: bool = False) -> None:
    """Run a question through KAG and send the reply with scheme and source buttons."""
    async with _user_locks[telegram_id]:
        async with _typing(msg):
            try:
                result = await asyncio.to_thread(_process_message, telegram_id, text, focus_scheme)
            except Exception:  # noqa: BLE001
                log.exception("KAG pipeline failed for Telegram user %s", telegram_id)
                lang = await asyncio.to_thread(_get_user_language, telegram_id)
                await msg.reply_text(ui("error", lang))
                return

    if "error" in result:
        await msg.reply_text(ui("error", "en"))
        return

    lang = result["language"]
    body = kag_to_html(result["answer"])
    if echo_question:
        body = f"❓ <i>{html.escape(text)}</i>\n\n{body}"
    # Discovery answers cite many facts, so they rely on the Sources button; focused answers
    # also show a short sources footer so the citizen sees where the answer came from.
    if result["evidence"] and result.get("intent") != "discover":
        body += format_sources(result["evidence"])
    markup = answer_keyboard(result["message_id"], len(result["evidence"]), result["schemes"], lang)
    await _send_html(msg, body, markup, quote=not echo_question)


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

async def _ensure_user(update: Update) -> tuple[str, str]:
    tg_user = update.effective_user
    telegram_id = str(tg_user.id)
    lang = await asyncio.to_thread(
        _get_or_create_user, telegram_id, tg_user.first_name or "", tg_user.last_name or "", tg_user.language_code,
    )
    return telegram_id, lang


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(WELCOME.get(lang, WELCOME["en"]), parse_mode=ParseMode.HTML)


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(HELP_TEXT.get(lang, HELP_TEXT["en"]), parse_mode=ParseMode.HTML)


async def cmd_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(ui("choose_lang", lang), reply_markup=language_keyboard())


async def cmd_new(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id, lang = await _ensure_user(update)
    await asyncio.to_thread(_start_new_conversation, telegram_id)
    await update.effective_message.reply_text(ui("new_chat", lang))


async def cmd_sources(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id, lang = await _ensure_user(update)
    evidence = await asyncio.to_thread(_get_last_evidence, telegram_id)
    if not evidence:
        await update.effective_message.reply_text(ui("no_sources", lang))
        return
    await _send_html(update.effective_message, format_evidence_detail(evidence))


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.effective_message
    text = (msg.text or "").strip() if msg else ""
    if not text:
        return
    telegram_id, lang = await _ensure_user(update)
    if len(text) > MAX_QUESTION_CHARS:
        await msg.reply_text(ui("too_long", lang))
        return
    await _answer(msg, telegram_id, text)


async def handle_non_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Voice notes, photos, stickers…: explain that only text is understood."""
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(ui("text_only", lang))


# ---------------------------------------------------------------------------
# Callback query handler
# ---------------------------------------------------------------------------

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    telegram_id, lang = await _ensure_user(update)

    if data.startswith("lang:"):
        new_lang = data[5:]
        if new_lang in LANGS:
            await asyncio.to_thread(_set_language, telegram_id, new_lang)
            await query.edit_message_text(ui("lang_set", new_lang, label=LANG_LABELS[new_lang]))
            await query.message.reply_text(WELCOME[new_lang], parse_mode=ParseMode.HTML)

    elif data.startswith("evidence:"):
        evidence = await asyncio.to_thread(_get_evidence_by_message_id, telegram_id, data[9:])
        if not evidence:
            await query.message.reply_text(ui("no_sources", lang))
            return
        await _send_html(query.message, format_evidence_detail(evidence), quote=False)

    elif data.startswith("scheme:"):
        code = data[7:]
        card = await asyncio.to_thread(_scheme_card_html, code, lang)
        if not card:
            await query.message.reply_text(ui("scheme_missing", lang))
            return
        await query.message.reply_text(card, parse_mode=ParseMode.HTML, reply_markup=scheme_keyboard(code, lang),
                                       disable_web_page_preview=True)

    elif data.startswith("ask:"):
        _, intent, code = data.split(":", 2)
        scheme = await asyncio.to_thread(get_graph().get_scheme, code)
        if intent not in ASK or not scheme:
            await query.message.reply_text(ui("scheme_missing", lang))
            return
        name = scheme.get("short_name") or localized_name(scheme, lang)
        question = (ASK[intent].get(lang) or ASK[intent]["en"]).format(name=name)
        await _answer(query.message, telegram_id, question, focus_scheme=code, echo_question=True)


async def handle_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.error("Unhandled Telegram bot error", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        with contextlib.suppress(Exception):
            await update.effective_message.reply_text(ui("error", "en"))
