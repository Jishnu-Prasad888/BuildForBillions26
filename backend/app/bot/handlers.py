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

from telegram import Message as TgMessage
from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from app.bot import conversation as conv
from app.bot.copy import ASK, HELP_HTML, LANG_LABELS, LANGS, WELCOME_HTML, ui
from app.bot.formatter import format_evidence_detail, format_sources, kag_to_html, scheme_card_html, split_message
from app.bot.keyboards import answer_keyboard, language_keyboard, scheme_keyboard
from app.graph import get_graph
from app.kag.templates import localized_name

log = logging.getLogger("bot")

CHANNEL = "telegram"
_user_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


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
                result = await asyncio.to_thread(conv.process_message, CHANNEL, telegram_id, text, focus_scheme)
            except Exception:  # noqa: BLE001
                log.exception("KAG pipeline failed for Telegram user %s", telegram_id)
                lang = await asyncio.to_thread(conv.get_user_language, CHANNEL, telegram_id)
                await msg.reply_text(ui("error", lang))
                return

    if "error" in result:
        await msg.reply_text(ui("error", "en"))
        return

    lang = result["language"]
    body = kag_to_html(result["answer"])
    if echo_question:
        body = f"❓ <i>{html.escape(text)}</i>\n\n{body}"
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
    full_name = f"{tg_user.first_name or ''} {tg_user.last_name or ''}".strip()
    lang = await asyncio.to_thread(
        conv.get_or_create_user, CHANNEL, telegram_id, full_name, tg_user.language_code,
    )
    return telegram_id, lang


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(WELCOME_HTML.get(lang, WELCOME_HTML["en"]), parse_mode=ParseMode.HTML)


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(HELP_HTML.get(lang, HELP_HTML["en"]), parse_mode=ParseMode.HTML)


async def cmd_language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _, lang = await _ensure_user(update)
    await update.effective_message.reply_text(ui("choose_lang", lang), reply_markup=language_keyboard())


async def cmd_new(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id, lang = await _ensure_user(update)
    await asyncio.to_thread(conv.start_new_conversation, CHANNEL, telegram_id)
    await update.effective_message.reply_text(ui("new_chat", lang))


async def cmd_sources(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id, lang = await _ensure_user(update)
    evidence = await asyncio.to_thread(conv.get_last_evidence, CHANNEL, telegram_id)
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
    if len(text) > conv.MAX_QUESTION_CHARS:
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
            await asyncio.to_thread(conv.set_language, CHANNEL, telegram_id, new_lang)
            await query.edit_message_text(ui("lang_set", new_lang, label=LANG_LABELS[new_lang]))
            await query.message.reply_text(WELCOME_HTML[new_lang], parse_mode=ParseMode.HTML)

    elif data.startswith("evidence:"):
        evidence = await asyncio.to_thread(conv.get_evidence_by_message_id, CHANNEL, telegram_id, data[9:])
        if not evidence:
            await query.message.reply_text(ui("no_sources", lang))
            return
        await _send_html(query.message, format_evidence_detail(evidence), quote=False)

    elif data.startswith("scheme:"):
        code = data[7:]
        info = await asyncio.to_thread(conv.scheme_info, code)
        if not info:
            await query.message.reply_text(ui("scheme_missing", lang))
            return
        card = scheme_card_html(info, lang)
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
