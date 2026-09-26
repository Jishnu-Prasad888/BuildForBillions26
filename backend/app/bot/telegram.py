"""Telegram bot application setup and lifecycle."""
from __future__ import annotations

import logging

from telegram import BotCommand
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from app.bot.handlers import (
    cmd_help,
    cmd_language,
    cmd_new,
    cmd_sources,
    cmd_start,
    handle_callback,
    handle_error,
    handle_message,
    handle_non_text,
)
from app.config import settings

log = logging.getLogger("bot")

COMMANDS = {
    "en": [("start", "Welcome and examples"), ("help", "How to use Sahayak"), ("language", "Change language"),
           ("new", "Start a new conversation"), ("sources", "Sources behind the last answer")],
    "hi": [("start", "स्वागत और उदाहरण"), ("help", "सहायक का उपयोग"), ("language", "भाषा बदलें"),
           ("new", "नई बातचीत"), ("sources", "पिछले उत्तर के स्रोत")],
    "kn": [("start", "ಸ್ವಾಗತ ಮತ್ತು ಉದಾಹರಣೆಗಳು"), ("help", "ಸಹಾಯಕ ಬಳಕೆ"), ("language", "ಭಾಷೆ ಬದಲಿಸಿ"),
           ("new", "ಹೊಸ ಸಂಭಾಷಣೆ"), ("sources", "ಹಿಂದಿನ ಉತ್ತರದ ಮೂಲಗಳು")],
}


def build_application() -> Application:
    # concurrent_updates: one citizen waiting on a slow LLM answer must not block everyone else;
    # handlers serialise each user's own messages with a per-user lock.
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).concurrent_updates(True).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("language", cmd_language))
    app.add_handler(CommandHandler("new", cmd_new))
    app.add_handler(CommandHandler("sources", cmd_sources))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.add_handler(MessageHandler(
        filters.VOICE | filters.AUDIO | filters.PHOTO | filters.VIDEO | filters.Document.ALL | filters.Sticker.ALL,
        handle_non_text,
    ))
    app.add_error_handler(handle_error)
    return app


async def _register_commands(app: Application) -> None:
    for lang, cmds in COMMANDS.items():
        try:
            await app.bot.set_my_commands([BotCommand(c, d) for c, d in cmds], language_code=None if lang == "en" else lang)
        except Exception:  # noqa: BLE001
            log.warning("Could not register %s bot commands", lang, exc_info=True)


async def start_polling(app: Application) -> None:
    await app.initialize()
    await _register_commands(app)
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    log.info("Telegram bot polling started (@%s)", app.bot.username)


async def stop_polling(app: Application) -> None:
    await app.updater.stop()
    await app.stop()
    await app.shutdown()
    log.info("Telegram bot stopped")
