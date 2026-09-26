from typing import Any

import httpx

from app.services.ai.provider import EmbeddingProvider, LLMProvider, ProviderError, strip_thinking


class OllamaLLM(LLMProvider):
    name = "ollama"

    def __init__(self, base_url: str, **kw):
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")

    def generate(self, messages: list[dict[str, Any]], json_mode: bool = False, images: list[str] | None = None) -> str:
        model = self.model
        msgs = [dict(m) for m in messages]
        if images:
            if not self.vision_model:
                raise ProviderError("No VISION_MODEL configured")
            model = self.vision_model
            msgs[-1]["images"] = images
        body: dict[str, Any] = {
            "model": model,
            "messages": msgs,
            "stream": False,
            "options": {"temperature": self.temperature},
        }
        if "qwen3" in model:
            body["think"] = False
        if json_mode:
            body["format"] = "json"
        try:
            r = httpx.post(f"{self.base_url}/api/chat", json=body, timeout=self.timeout)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"Ollama generate failed: {exc}") from exc
        return strip_thinking(r.json().get("message", {}).get("content", ""))

    def ping(self) -> bool:
        r = httpx.get(f"{self.base_url}/api/tags", timeout=3)
        r.raise_for_status()
        names = {m.get("name", "") for m in r.json().get("models", [])}
        return self.model in names or f"{self.model}:latest" in names


class OllamaEmbeddings(EmbeddingProvider):
    name = "ollama"

    def __init__(self, base_url: str, **kw):
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")

    def _prefix(self, kind: str) -> str:
        # nomic-embed-text is trained with task prefixes
        if "nomic" in self.model:
            return "search_query: " if kind == "query" else "search_document: "
        return ""

    def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        prefix = self._prefix(kind)
        inputs = [prefix + t for t in texts]
        try:
            r = httpx.post(f"{self.base_url}/api/embed", json={"model": self.model, "input": inputs}, timeout=self.timeout)
            if r.status_code == 404:  # older Ollama
                out = []
                for t in inputs:
                    r2 = httpx.post(f"{self.base_url}/api/embeddings", json={"model": self.model, "prompt": t}, timeout=self.timeout)
                    r2.raise_for_status()
                    out.append(r2.json()["embedding"])
                return out
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"Ollama embed failed: {exc}") from exc
        embs = r.json().get("embeddings", [])
        if embs and len(embs[0]) != self.dim:
            raise ProviderError(f"Embedding dim {len(embs[0])} != EMBEDDING_DIM {self.dim}")
        return embs

    def ping(self) -> bool:
        r = httpx.get(f"{self.base_url}/api/tags", timeout=3)
        r.raise_for_status()
        names = {m.get("name", "") for m in r.json().get("models", [])}
        return self.model in names or f"{self.model}:latest" in names
