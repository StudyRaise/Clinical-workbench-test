from __future__ import annotations

import os
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


class LLMRouter:
    """Proxy to whichever LLM provider chain you configure."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url or os.getenv("LLM_PROVIDER_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.client = httpx.AsyncClient(timeout=30.0)

    @retry(wait=wait_exponential(multiplier=0.5, max=6), stop=stop_after_attempt(3))
    async def complete(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.base_url.startswith("https://api.openai.com"):
            headers = {"Authorization": f"Bearer {self.api_key}"}
            response = await self.client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
        else:
            response = await self.client.post(f"{self.base_url}/completions", json=payload)
        response.raise_for_status()
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()


class EmbeddingRouter:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url or os.getenv("LLM_PROVIDER_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.client = httpx.AsyncClient(timeout=60.0)

    @retry(wait=wait_exponential(multiplier=0.5, max=6), stop=stop_after_attempt(3))
    async def embed(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = await self.client.post(f"{self.base_url}/embeddings", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()
