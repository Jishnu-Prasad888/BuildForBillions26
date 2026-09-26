"""AI service facade: ``get_ai().generate(...)`` / ``get_ai().embed(...)``."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from app.config import settings
from app.services.ai.kimi import KimiLLM
from app.services.ai.ollama import OllamaEmbeddings, OllamaLLM
from app.services.ai.openai import OpenAIEmbeddings, OpenAILLM
from app.services.ai.provider import (
    AvailabilityCache,
    EmbeddingProvider,
    HashEmbeddingProvider,
    LLMProvider,
    ProviderError,
    parse_json_loose,
)

log = logging.getLogger(__name__)


def _build_llm() -> LLMProvider:
    common = dict(
        model=settings.LLM_MODEL,
        vision_model=settings.VISION_MODEL,
        timeout=settings.LLM_TIMEOUT_SECONDS,
        temperature=settings.LLM_TEMPERATURE,
    )
    p = settings.LLM_PROVIDER.lower()
    if p == "ollama":
        return OllamaLLM(base_url=settings.OLLAMA_BASE_URL, **common)
    if p == "openai":
        return OpenAILLM(base_url=settings.OPENAI_BASE_URL, api_key=settings.OPENAI_API_KEY, **common)
    if p == "kimi":
        return KimiLLM(base_url=settings.KIMI_BASE_URL, api_key=settings.KIMI_API_KEY, **common)
    raise ValueError(f"Unknown LLM_PROVIDER: {settings.LLM_PROVIDER}")


def _build_embedder() -> EmbeddingProvider:
    p = settings.EMBEDDING_PROVIDER.lower()
    common = dict(model=settings.embedding_model, dim=settings.EMBEDDING_DIM)
    if p == "ollama":
        return OllamaEmbeddings(base_url=settings.OLLAMA_BASE_URL, **common)
    if p == "openai":
        return OpenAIEmbeddings(base_url=settings.OPENAI_BASE_URL, api_key=settings.OPENAI_API_KEY, **common)
    raise ValueError(f"Unknown EMBEDDING_PROVIDER: {settings.EMBEDDING_PROVIDER}")


class AIService:
    def __init__(self) -> None:
        self.llm = _build_llm()
        self.embedder = _build_embedder()
        self.fallback_embedder = HashEmbeddingProvider(settings.EMBEDDING_DIM)
        self._avail = AvailabilityCache(ttl=30)

    # ---- availability -------------------------------------------------
    def llm_available(self) -> bool:
        return self._avail.check("llm", self.llm.ping)

    def embeddings_available(self) -> bool:
        return self._avail.check("embed", self.embedder.ping)

    def vision_available(self) -> bool:
        return bool(settings.VISION_MODEL) and self.llm_available()

    # ---- generation ---------------------------------------------------
    def generate(self, messages: list[dict[str, Any]], json_mode: bool = False, images: list[str] | None = None) -> str | None:
        """Returns None when no LLM is reachable (callers then use deterministic composition)."""
        if not self.llm_available():
            if settings.AI_FALLBACK_ENABLED:
                return None
            raise ProviderError("LLM provider unavailable")
        try:
            return self.llm.generate(messages, json_mode=json_mode, images=images)
        except ProviderError as exc:
            log.warning("LLM call failed: %s", exc)
            self._avail.mark("llm", False)
            if settings.AI_FALLBACK_ENABLED:
                return None
            raise

    def generate_json(self, messages: list[dict[str, Any]], images: list[str] | None = None) -> dict | None:
        out = self.generate(messages, json_mode=True, images=images)
        return parse_json_loose(out) if out else None

    # ---- embeddings ---------------------------------------------------
    def embed(self, texts: list[str], kind: str = "document") -> tuple[list[list[float]], str]:
        """Returns (vectors, model_name). model_name is stored per chunk so we never
        compare vectors from different embedding spaces."""
        if self.embeddings_available():
            try:
                out: list[list[float]] = []
                for i in range(0, len(texts), 32):
                    out += self.embedder.embed(texts[i : i + 32], kind=kind)
                return out, self.embedding_model_id
            except ProviderError as exc:
                log.warning("Embedding failed: %s", exc)
                self._avail.mark("embed", False)
                if not settings.AI_FALLBACK_ENABLED:
                    raise
        elif not settings.AI_FALLBACK_ENABLED:
            raise ProviderError("Embedding provider unavailable")
        return self.fallback_embedder.embed(texts, kind), self.fallback_embedder.model

    @property
    def embedding_model_id(self) -> str:
        return f"{self.embedder.name}:{self.embedder.model}"

    def health(self) -> dict:
        llm_ok = self.llm_available()
        emb_ok = self.embeddings_available()
        return {
            "llm_provider": self.llm.name,
            "llm_model": self.llm.model,
            "llm_status": "connected" if llm_ok else "unavailable",
            "vision_model": settings.VISION_MODEL or None,
            "vision_status": "connected" if (settings.VISION_MODEL and llm_ok) else "disabled",
            "embedding_provider": self.embedder.name,
            "embedding_model": self.embedder.model,
            "embedding_dim": settings.EMBEDDING_DIM,
            "embedding_status": "connected" if emb_ok else "unavailable",
            "fallback_enabled": settings.AI_FALLBACK_ENABLED,
            "fallback_active": {
                "llm": not llm_ok and settings.AI_FALLBACK_ENABLED,
                "embeddings": not emb_ok and settings.AI_FALLBACK_ENABLED,
            },
            "status": "connected" if (llm_ok and emb_ok) else ("degraded" if settings.AI_FALLBACK_ENABLED else "unavailable"),
        }


@lru_cache
def get_ai() -> AIService:
    return AIService()


__all__ = ["get_ai", "AIService", "ProviderError", "parse_json_loose"]
