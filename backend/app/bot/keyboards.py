"""Telegram inline keyboards.

Callback data (max 64 bytes):
  lang:<code>                  set language
  evidence:<message_id>        show the evidence behind an answer
  scheme:<SCHEME_CODE>         show a scheme card
  ask:<intent>:<SCHEME_CODE>   ask a follow-up about one scheme (documents | eligibility | how_to_apply | amount)
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

BUTTONS = {
    "evidence": {"en": "📚 Sources ({n})", "hi": "📚 स्रोत ({n})", "kn": "📚 ಮೂಲಗಳು ({n})"},
    "documents": {"en": "📄 Documents", "hi": "📄 दस्तावेज़", "kn": "📄 ದಾಖಲೆಗಳು"},
    "eligibility": {"en": "✅ Eligibility", "hi": "✅ पात्रता", "kn": "✅ ಅರ್ಹತೆ"},
    "how_to_apply": {"en": "📝 How to apply", "hi": "📝 आवेदन कैसे करें", "kn": "📝 ಅರ್ಜಿ ಹೇಗೆ"},
    "amount": {"en": "💰 Benefit", "hi": "💰 लाभ", "kn": "💰 ಪ್ರಯೋಜನ"},
}


def _label(key: str, lang: str, **kw) -> str:
    entry = BUTTONS[key]
    return (entry.get(lang) or entry["en"]).format(**kw)


def language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("🇬🇧 English", callback_data="lang:en"),
        InlineKeyboardButton("🇮🇳 हिन्दी", callback_data="lang:hi"),
        InlineKeyboardButton("🇮🇳 ಕನ್ನಡ", callback_data="lang:kn"),
    ]])


def answer_keyboard(message_id: str, evidence_count: int, schemes: list[dict], lang: str) -> InlineKeyboardMarkup | None:
    """One button per suggested scheme (opens its card) plus a sources button."""
    rows = [[InlineKeyboardButton(f"ℹ️ {s.get('short_name') or s['display_name']}", callback_data=f"scheme:{s['code']}")]
            for s in schemes[:4]]
    if evidence_count:
        rows.append([InlineKeyboardButton(_label("evidence", lang, n=evidence_count), callback_data=f"evidence:{message_id}")])
    return InlineKeyboardMarkup(rows) if rows else None


def scheme_keyboard(code: str, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(_label("documents", lang), callback_data=f"ask:documents:{code}"),
         InlineKeyboardButton(_label("eligibility", lang), callback_data=f"ask:eligibility:{code}")],
        [InlineKeyboardButton(_label("how_to_apply", lang), callback_data=f"ask:how_to_apply:{code}"),
         InlineKeyboardButton(_label("amount", lang), callback_data=f"ask:amount:{code}")],
    ])
