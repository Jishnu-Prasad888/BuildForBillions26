from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_extensions() -> None:
    if settings.VECTOR_BACKEND == "pgvector":
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


# Columns added to the form-assistant tables after they were first created. Kept here so an existing database
# gets the same shape as a fresh one; `create_all` never adds columns to a table that already exists.
_FORM_ASSIST_COLUMNS = (
    "ALTER TABLE form_pages ADD COLUMN IF NOT EXISTS structure JSONB NOT NULL DEFAULT '{}'",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS normalized_label VARCHAR(64) NOT NULL DEFAULT ''",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS input_type VARCHAR(16) NOT NULL DEFAULT 'text'",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS label_bbox JSONB NOT NULL DEFAULT '[]'",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS conditional BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS section VARCHAR(120) NOT NULL DEFAULT ''",
    "ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'detected'",
)


def ensure_migrations() -> None:
    """Add columns introduced after initial schema creation (safe on fresh DBs too)."""
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(32) UNIQUE"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_id VARCHAR(32) UNIQUE"
        ))
        for ddl in _FORM_ASSIST_COLUMNS:
            conn.execute(text(ddl))
