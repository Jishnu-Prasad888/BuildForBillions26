"""Common AI provider interface.

The rest of the application (KAG agent, form assistant, ingestion) only talks to
``get_ai()`` which exposes ``generate()`` and ``embed()``. The concrete provider
(Ollama / OpenAI / Kimi) is chosen from settings at startup.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import time
from abc import ABC, abstractmethod
from typing import Any

log = logging.getLogger(__name__)


class ProviderError(RuntimeError):
    pass


class LLMProvider(ABC):
    name: str = "base"

    def __init__(self, model: str, vision_model: str = "", timeout: float = 120.0, temperature: float = 0.2):
        self.model = model
        self.vision_model = vision_model
        self.timeout = timeout
        self.temperature = temperature

    @abstractmethod
    def generate(self, messages: list[dict[str, Any]], json_mode: bool = False, images: list[str] | None = None) -> str:
        """Return the assistant text. ``images`` are base64 JPEG/PNG (no data: prefix)."""

    @abstractmethod
    def ping(self) -> bool:
        ...


class EmbeddingProvider(ABC):
    name: str = "base"

    def __init__(self, model: str, dim: int, timeout: float = 60.0):
        self.model = model
        self.dim = dim
        self.timeout = timeout

    @abstractmethod
    def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        ...

    @abstractmethod
    def ping(self) -> bool:
        ...


class HashEmbeddingProvider(EmbeddingProvider):
    """Deterministic lexical embedding used ONLY when the configured embedding
    provider is unreachable. Clearly reported as 'fallback' in health checks."""

    name = "fallback-hash"

    def __init__(self, dim: int):
        super().__init__(model="hash-fallback", dim=dim)

    def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        words = re.findall(r"\w+", text.lower())
        feats = words + [f"{a}_{b}" for a, b in zip(words, words[1:])]
        for w in words:
            padded = f"#{w}#"
            feats += [padded[i : i + 3] for i in range(max(1, len(padded) - 2))]
        for f in feats:
            h = int(hashlib.md5(f.encode()).hexdigest(), 16)
            vec[h % self.dim] += 1.0 if (h >> 8) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def ping(self) -> bool:
        return True


def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks that reasoning models (e.g. qwen3) emit."""
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def parse_json_loose(text: str) -> dict | None:
    text = strip_thinking(text)
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, flags=re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


class AvailabilityCache:
    """Avoid waiting on long timeouts every request when a provider is down."""

    def __init__(self, ttl: float = 30.0):
        self.ttl = ttl
        self._state: dict[str, tuple[float, bool]] = {}

    def check(self, key: str, fn) -> bool:
        now = time.time()
        cached = self._state.get(key)
        if cached and now - cached[0] < self.ttl:
            return cached[1]
        try:
            ok = bool(fn())
        except Exception as exc:  # noqa: BLE001
            log.info("AI provider %s unavailable: %s", key, exc)
            ok = False
        self._state[key] = (now, ok)
        return ok

    def mark(self, key: str, ok: bool) -> None:
        self._state[key] = (time.time(), ok)
