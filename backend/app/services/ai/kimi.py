from app.services.ai.openai import OpenAICompatibleLLM


class KimiLLM(OpenAICompatibleLLM):
    """Moonshot Kimi exposes an OpenAI-compatible API; endpoint/model come from settings."""

    name = "kimi"
