"""Telegram bot application setup and lifecycle."""
from __future__ import annotations

import logging

from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from app.bot.handlers import (
    cmd_help,
    cmd_language,
    cmd_sources,
    cmd_start,
    handle_callback,
    handle_message,
)
from app.config import settings

log = logging.getLogger("bot")


def build_application() -> Application:
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("language", cmd_language))
    app.add_handler(CommandHandler("sources", cmd_sources))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app


async def start_polling(app: Application) -> None:
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    log.info("Telegram bot polling started (@%s)", (await app.bot.get_me()).username)


async def stop_polling(app: Application) -> None:
    await app.updater.stop()
    await app.stop()
    await app.shutdown()
    log.info("Telegram bot stopped")
