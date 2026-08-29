from __future__ import annotations

import os
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings


def _resolve_llm_base_url() -> str:
    """LLM 端点解析顺序：全局 LLM_BASE_URL -> provider 默认 -> 旧环境变量兜底。"""
    return (
        settings.llm_base_url
        or settings.sensenova_base_url
        or os.getenv("LLM_PROVIDER_URL", "https://token.sensenova.cn/v1")
    )


def _resolve_llm_api_key() -> str:
    """LLM Key 解析顺序：全局 LLM_API_KEY -> SENSENOVA_API_KEY -> 旧环境变量兜底。"""
    return (
        settings.llm_api_key
        or settings.sensenova_api_key
        or os.getenv("OPENAI_API_KEY", "")
    )


class LLMRouter:
    """Proxy to whichever LLM provider chain you configure.

    兼容 OpenAI / SenseNova 的 /chat/completions 接口，Bearer Token 鉴权。
    """

    def __init__(self, base_url: str | None = None, api_key: str | None = None) -> None:
        self.base_url = base_url or _resolve_llm_base_url()
        self.api_key = api_key or _resolve_llm_api_key()
        self.client = httpx.AsyncClient(timeout=30.0)

    @retry(wait=wait_exponential(multiplier=0.5, max=6), stop=stop_after_attempt(3))
    async def complete(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = await self.client.post(
            f"{self.base_url.rstrip('/')}/chat/completions", json=payload, headers=headers
        )
        response.raise_for_status()
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()


class EmbeddingRouter:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url or _resolve_llm_base_url()
        self.api_key = _resolve_llm_api_key()
        self.client = httpx.AsyncClient(timeout=60.0)

    @retry(wait=wait_exponential(multiplier=0.5, max=6), stop=stop_after_attempt(3))
    async def embed(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = await self.client.post(
            f"{self.base_url.rstrip('/')}/embeddings", json=payload, headers=headers
        )
        response.raise_for_status()
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()
