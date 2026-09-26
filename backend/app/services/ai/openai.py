from typing import Any

import httpx

from app.services.ai.provider import EmbeddingProvider, LLMProvider, ProviderError, strip_thinking


class OpenAICompatibleLLM(LLMProvider):
    """Any OpenAI-compatible /chat/completions endpoint."""

    name = "openai"

    def __init__(self, base_url: str, api_key: str, **kw):
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"}

    def generate(self, messages: list[dict[str, Any]], json_mode: bool = False, images: list[str] | None = None) -> str:
        if not self.api_key:
            raise ProviderError(f"{self.name}: API key not configured")
        model = self.model
        msgs = [dict(m) for m in messages]
        if images:
            model = self.vision_model or self.model
            parts: list[dict] = [{"type": "text", "text": msgs[-1]["content"]}]
            parts += [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}} for img in images]
            msgs[-1]["content"] = parts
        body: dict[str, Any] = {"model": model, "messages": msgs}
        if not model.startswith(("gpt-5", "o1", "o3", "o4")):
            body["temperature"] = self.temperature
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            r = httpx.post(f"{self.base_url}/chat/completions", json=body, headers=self._headers(), timeout=self.timeout)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"{self.name} generate failed: {exc}") from exc
        return strip_thinking(r.json()["choices"][0]["message"]["content"] or "")

    def ping(self) -> bool:
        if not self.api_key:
            return False
        r = httpx.get(f"{self.base_url}/models", headers=self._headers(), timeout=5)
        return r.status_code == 200


class OpenAILLM(OpenAICompatibleLLM):
    name = "openai"


class OpenAIEmbeddings(EmbeddingProvider):
    name = "openai"

    def __init__(self, base_url: str, api_key: str, **kw):
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        if not self.api_key:
            raise ProviderError("OpenAI API key not configured")
        try:
            r = httpx.post(
                f"{self.base_url}/embeddings",
                json={"model": self.model, "input": texts, "dimensions": self.dim},
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=self.timeout,
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"OpenAI embed failed: {exc}") from exc
        return [d["embedding"] for d in r.json()["data"]]

    def ping(self) -> bool:
        return bool(self.api_key)
