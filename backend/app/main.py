import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models  # noqa: F401  (register tables)
from app.api import admin, applications, assistant, auth, documents, health, notes, schemes, screen
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.database.session import ensure_extensions, ensure_migrations
from app.ratelimit import RateLimitMiddleware
from app.services.seed import maybe_reembed, run_all

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "httpcore", "neo4j", "multipart"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
logging.getLogger("neo4j.notifications").setLevel(logging.ERROR)
log = logging.getLogger("app")


async def reembed_when_ready() -> None:
    """If the embedding model was still downloading at startup, chunks were embedded with the
    lexical fallback. Re-embed them automatically once the real provider becomes available."""
    while True:
        await asyncio.sleep(60)
        db = SessionLocal()
        try:
            await asyncio.to_thread(maybe_reembed, db)
        except Exception:  # noqa: BLE001
            log.exception("Background re-embed failed")
        finally:
            db.close()


STARTUP_LOCK_ID = 727_001  # arbitrary; shared by every replica of this app


def initialize_database() -> None:
    """Schema setup and seeding. Replicas start concurrently, so serialise with a Postgres advisory lock."""
    with engine.connect() as lock_conn:
        lock_conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": STARTUP_LOCK_ID})
        try:
            ensure_extensions()
            Base.metadata.create_all(engine)
            ensure_migrations()
            db = SessionLocal()
            try:
                run_all(db)
            except Exception:  # noqa: BLE001
                log.exception("Seeding failed – the API will still start")
            finally:
                db.close()
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": STARTUP_LOCK_ID})


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    task = asyncio.create_task(reembed_when_ready()) if settings.RUN_BACKGROUND_TASKS else None

    bot_app = None
    if settings.TELEGRAM_BOT_TOKEN and settings.RUN_BACKGROUND_TASKS:
        try:
            from app.bot.telegram import build_application, start_polling, stop_polling
            bot_app = build_application()
            await start_polling(bot_app)
        except Exception:  # noqa: BLE001
            log.exception("Telegram bot failed to start – API will still run")
            bot_app = None

    yield

    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    if bot_app is not None:
        try:
            from app.bot.telegram import stop_polling  # already imported above, kept for clarity
            await stop_polling(bot_app)
        except Exception:  # noqa: BLE001
            log.exception("Error stopping Telegram bot")


docs = {} if settings.APP_ENV != "production" else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="Public Service AI Assistant (Build for Billions prototype)", version="0.1.0", lifespan=lifespan, **docs)
app.add_middleware(RateLimitMiddleware)  # added first, so CORS wraps it and 429s carry CORS headers
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in (auth.router, auth.users_router, health.router, schemes.router, assistant.router, assistant.kag_router,
          applications.router, notes.router, documents.router, screen.router, admin.router):
    app.include_router(r)


@app.get("/")
def root():
    return {"name": "Public Service AI Assistant API", "docs": "/docs", "demo_mode": settings.DEMO_MODE}
