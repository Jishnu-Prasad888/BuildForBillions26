"""Telegram inline keyboards."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("🇬🇧 English", callback_data="lang:en"),
        InlineKeyboardButton("🇮🇳 हिन्दी", callback_data="lang:hi"),
        InlineKeyboardButton("🇮🇳 ಕನ್ನಡ", callback_data="lang:kn"),
    ]])


def evidence_keyboard(message_id: str, count: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(f"📚 Show Evidence ({count})", callback_data=f"evidence:{message_id}"),
    ]])


def state_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Karnataka", callback_data="state:KA"),
        InlineKeyboardButton("Other State", callback_data="state:OTHER"),
    ]])
