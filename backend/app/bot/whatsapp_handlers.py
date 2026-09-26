"""WhatsApp message dispatch: same KAG pipeline as Telegram and the web assistant."""
from __future__ import annotations

import asyncio
import logging
import re
from collections import OrderedDict, defaultdict

from app.bot import conversation as conv
from app.bot.copy import ASK, BUTTONS, HELP_TEXT, LANG_LABELS, LANGS, WELCOME, button_label, ui
from app.bot.formatter import (
    format_evidence_detail_whatsapp,
    format_sources_whatsapp,
    kag_to_whatsapp,
    scheme_card_whatsapp,
)
from app.bot.whatsapp_client import WhatsAppClient
from app.graph import get_graph
from app.kag.templates import localized_name

log = logging.getLogger("whatsapp")

CHANNEL = "whatsapp"
_client = WhatsAppClient()
_user_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
_seen: OrderedDict[str, None] = OrderedDict()
_SEEN_MAX = 4000

# Whole-message commands only, so "help me, my crop failed" still reaches KAG.
_CMD = re.compile(r"^[/!]?(start|help|language|lang|new|sources)\s*[!.]*$", re.I)
_HI = re.compile(r"^(hi|hello|hey|namaste|namaskar|ನಮಸ್ಕಾರ|नमस्ते)\s*[!.]*$", re.I)


def _seen_already(mid: str) -> bool:
    if not mid:
        return False
    if mid in _seen:
        return True
    _seen[mid] = None
    while len(_seen) > _SEEN_MAX:
        _seen.popitem(last=False)
    return False


def _clip(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


async def _ensure(phone: str, name: str) -> str:
    return await asyncio.to_thread(conv.get_or_create_user, CHANNEL, phone, name, None)


async def _answer(phone: str, text: str, focus_scheme: str | None = None, echo_question: bool = False) -> None:
    async with _user_locks[phone]:
        try:
            result = await asyncio.to_thread(conv.process_message, CHANNEL, phone, text, focus_scheme)
        except Exception:  # noqa: BLE001
            log.exception("KAG pipeline failed for WhatsApp user %s", phone)
            lang = await asyncio.to_thread(conv.get_user_language, CHANNEL, phone)
            await _client.send_text(phone, ui("error", lang))
            return

    if "error" in result:
        await _client.send_text(phone, ui("error", "en"))
        return

    lang = result["language"]
    body = kag_to_whatsapp(result["answer"])
    if echo_question:
        body = f"❓ _{text}_\n\n{body}"
    if result["evidence"] and result.get("intent") != "discover":
        body += format_sources_whatsapp(result["evidence"])
    await _client.send_text(phone, body)

    rows: list[dict] = []
    for s in result["schemes"][:6]:
        title = s.get("short_name") or s.get("display_name") or s["code"]
        rows.append({"id": f"scheme:{s['code']}", "title": _clip(title, 24), "description": _clip(s.get("summary") or "", 72)})
    if result["evidence"]:
        rows.append({
            "id": f"evidence:{result['message_id']}",
            "title": _clip(button_label("evidence", lang, n=len(result["evidence"])), 24),
            "description": _clip("Official sources for this answer", 72),
        })
    if rows:
        await _client.send_list(phone, ui("scheme_hint", lang), ui("options", lang), ui("schemes", lang), rows)


async def _welcome_kit(phone: str, lang: str) -> None:
    await _client.send_buttons(
        phone,
        WELCOME.get(lang, WELCOME["en"]),
        [("menu:language", "Language"), ("menu:help", "Help"), ("menu:new", "New chat")],
    )


async def handle_text_command(phone: str, lang: str, text: str) -> bool:
    low = text.strip().lower()
    m = _CMD.match(low)
    if _HI.match(text.strip()) or (m and m.group(1).lower() == "start"):
        await _welcome_kit(phone, lang)
        return True
    if not m:
        return False
    cmd = m.group(1).lower()
    if cmd == "help":
        await _client.send_text(phone, HELP_TEXT.get(lang, HELP_TEXT["en"]))
        return True
    if cmd in ("language", "lang"):
        await _client.send_buttons(
            phone, ui("choose_lang", lang),
            [("lang:en", "English"), ("lang:hi", "हिन्दी"), ("lang:kn", "ಕನ್ನಡ")],
        )
        return True
    if cmd == "new":
        await asyncio.to_thread(conv.start_new_conversation, CHANNEL, phone)
        await _client.send_text(phone, ui("new_chat", lang))
        return True
    if cmd == "sources":
        evidence = await asyncio.to_thread(conv.get_last_evidence, CHANNEL, phone)
        if not evidence:
            await _client.send_text(phone, ui("no_sources", lang))
        else:
            await _client.send_text(phone, format_evidence_detail_whatsapp(evidence))
        return True
    return False


async def handle_callback(phone: str, lang: str, data: str) -> None:
    if data.startswith("lang:"):
        new_lang = data[5:]
        if new_lang in LANGS:
            await asyncio.to_thread(conv.set_language, CHANNEL, phone, new_lang)
            await _client.send_text(phone, ui("lang_set", new_lang, label=LANG_LABELS[new_lang]))
            await _welcome_kit(phone, new_lang)
        return
    if data == "menu:language":
        await handle_text_command(phone, lang, "language")
        return
    if data == "menu:help":
        await handle_text_command(phone, lang, "help")
        return
    if data == "menu:new":
        await handle_text_command(phone, lang, "new")
        return
    if data.startswith("evidence:"):
        evidence = await asyncio.to_thread(conv.get_evidence_by_message_id, CHANNEL, phone, data[9:])
        if not evidence:
            await _client.send_text(phone, ui("no_sources", lang))
            return
        await _client.send_text(phone, format_evidence_detail_whatsapp(evidence))
        return
    if data.startswith("scheme:"):
        code = data[7:]
        info = await asyncio.to_thread(conv.scheme_info, code)
        if not info:
            await _client.send_text(phone, ui("scheme_missing", lang))
            return
        await _client.send_text(phone, scheme_card_whatsapp(info, lang))
        await _client.send_list(
            phone,
            ui("scheme_hint", lang),
            ui("options", lang),
            _clip(info["short_name"], 24),
            [
                {"id": f"ask:{intent}:{code}",
                 "title": _clip((BUTTONS[intent].get(lang) or BUTTONS[intent]["en"]), 24),
                 "description": ""}
                for intent in ("documents", "eligibility", "how_to_apply", "amount")
            ],
        )
        return
    if data.startswith("ask:"):
        parts = data.split(":", 2)
        if len(parts) != 3:
            return
        _, intent, code = parts
        scheme = await asyncio.to_thread(get_graph().get_scheme, code)
        if intent not in ASK or not scheme:
            await _client.send_text(phone, ui("scheme_missing", lang))
            return
        name = scheme.get("short_name") or localized_name(scheme, lang)
        question = (ASK[intent].get(lang) or ASK[intent]["en"]).format(name=name)
        await _answer(phone, question, focus_scheme=code, echo_question=True)


async def handle_incoming_message(msg: dict, value: dict) -> None:
    mid = msg.get("id") or ""
    if _seen_already(mid):
        return
    phone = msg.get("from") or ""
    if not phone:
        return
    contacts = value.get("contacts") or []
    name = ((contacts[0].get("profile") or {}).get("name") if contacts else "") or "WhatsApp User"
    lang = await _ensure(phone, name)
    if mid:
        await _client.mark_read(mid)

    typ = msg.get("type")
    if typ == "text":
        text = ((msg.get("text") or {}).get("body") or "").strip()
        if not text:
            return
        if await handle_text_command(phone, lang, text):
            return
        if len(text) > conv.MAX_QUESTION_CHARS:
            await _client.send_text(phone, ui("too_long", lang))
            return
        await _answer(phone, text)
        return

    if typ == "interactive":
        inter = msg.get("interactive") or {}
        itype = inter.get("type")
        data = ""
        if itype == "button_reply":
            data = (inter.get("button_reply") or {}).get("id") or ""
        elif itype == "list_reply":
            data = (inter.get("list_reply") or {}).get("id") or ""
        if data:
            await handle_callback(phone, lang, data)
        return

    await _client.send_text(phone, ui("text_only", lang))


async def dispatch_payload(payload: dict) -> None:
    if not _client.enabled:
        return
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for msg in value.get("messages") or []:
                try:
                    await handle_incoming_message(msg, value)
                except Exception:  # noqa: BLE001
                    log.exception("WhatsApp handler failed")
