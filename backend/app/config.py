"""Typed application settings. Every service reads configuration from here."""
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    APP_ENV: str = "development"
    DEBUG: bool = True
    DEMO_MODE: bool = True

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/public_service_ai"
    VECTOR_BACKEND: str = "chroma"  # chroma | pgvector | json

    # ChromaDB: embedded (persisted under CHROMA_DIR) unless CHROMA_HOST points at a Chroma server.
    # Use a server when running several API replicas so they share one index.
    CHROMA_DIR: str = "./data/chroma"
    CHROMA_HOST: str = ""
    CHROMA_PORT: int = 8000
    CHROMA_COLLECTION: str = "knowledge_chunks"

    # Scraped scheme library (one sub-folder per page: meta.json + content.txt), synced into the
    # knowledge base in the background at startup and on demand from the admin Knowledge Base tab.
    SCHEME_DIR: str = "../scheme"
    SCHEME_AUTO_SYNC: bool = True

    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_CONNECT_RETRIES: int = 1

    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "qwen3:8b"
    VISION_MODEL: str = ""
    OCR_ENABLED: bool = True
    TESSERACT_CMD: str = ""
    LLM_TIMEOUT_SECONDS: float = 120.0
    LLM_TEMPERATURE: float = 0.2

    EMBEDDING_PROVIDER: str = "ollama"
    EMBEDDING_MODEL: str = ""
    EMBEDDING_DIM: int = 768

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.ai/v1"

    AI_FALLBACK_ENABLED: bool = True

    # Sentry monitoring: off while SENTRY_DSN is empty. Keep sample rates low at scale (cost grows with traffic).
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = ""  # defaults to APP_ENV
    SENTRY_RELEASE: str = ""  # e.g. the git SHA of the deployed image
    SENTRY_SERVER_NAME: str = ""  # set per replica (e.g. the container name) to tell replicas apart; the SDK falls back to the hostname
    SENTRY_TRACES_SAMPLE_RATE: float = 0.05
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.0

    JWT_SECRET_KEY: str = "change-this-in-development"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    # AI Form Assistant: private per-user storage (<FORMS_DIR>/<user_id>/forms/<form_id>/...).
    # Never place this under a directory that is served publicly.
    FORMS_DIR: str = "./data/users"
    MAX_FORM_SIZE_MB: int = 25
    MAX_FORM_PAGES: int = 40
    FORM_LLM_ENABLED: bool = True  # let the LLM refine field types/required flags (labels only, never values)
    FORM_FONT_PATH: str = ""  # optional TTF used for non-Latin text (Hindi/Kannada) when filling PDFs

    SEED_DIR: str = "../data/seed"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    TELEGRAM_BOT_TOKEN: str = ""

    # WhatsApp Cloud API (Meta). Leave token/phone id empty to disable.
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_GRAPH_VERSION: str = "v21.0"

    # Run the re-embed loop and Telegram bot in this process. Enable in exactly one
    # container when running several API replicas (the bot allows only one poller).
    RUN_BACKGROUND_TASKS: bool = True

    # Rate limiting (GCRA). "count/period:burst", period = second | minute | hour.
    # REDIS_URL shares limits across replicas and workers; without it limits are per process.
    RATE_LIMIT_ENABLED: bool = True
    REDIS_URL: str = ""
    RATE_LIMIT_DEFAULT: str = "180/minute:60"
    RATE_LIMIT_AUTH: str = "20/minute:10"
    RATE_LIMIT_AI: str = "20/minute:8"
    RATE_LIMIT_UPLOAD: str = "10/minute:5"

    @model_validator(mode="after")
    def _production_safety(self) -> "Settings":
        if self.APP_ENV == "production" and self.JWT_SECRET_KEY in ("", "change-this-in-development"):
            raise ValueError("JWT_SECRET_KEY must be set to a strong random value when APP_ENV=production")
        return self

    @property
    def embedding_model(self) -> str:
        """EMBEDDING_MODEL wins; OLLAMA_EMBED_MODEL is the Ollama-specific fallback."""
        if self.EMBEDDING_MODEL:
            return self.EMBEDDING_MODEL
        return self.OLLAMA_EMBED_MODEL

    @property
    def seed_path(self) -> Path:
        p = Path(self.SEED_DIR)
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()

    @property
    def chroma_path(self) -> Path:
        p = Path(self.CHROMA_DIR)
        p = p if p.is_absolute() else (BACKEND_DIR / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def scheme_path(self) -> Path:
        p = Path(self.SCHEME_DIR)
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p = p if p.is_absolute() else (BACKEND_DIR / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def forms_path(self) -> Path:
        p = Path(self.FORMS_DIR)
        p = p if p.is_absolute() else (BACKEND_DIR / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def max_form_bytes(self) -> int:
        return self.MAX_FORM_SIZE_MB * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
