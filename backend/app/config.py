"""Typed application settings. Every service reads configuration from here."""
from functools import lru_cache
from pathlib import Path

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
    VECTOR_BACKEND: str = "pgvector"  # pgvector | json

    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_CONNECT_RETRIES: int = 1

    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "qwen3:8b"
    VISION_MODEL: str = ""
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

    JWT_SECRET_KEY: str = "change-this-in-development"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    SEED_DIR: str = "../data/seed"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    TELEGRAM_BOT_TOKEN: str = ""

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
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p = p if p.is_absolute() else (BACKEND_DIR / p).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
