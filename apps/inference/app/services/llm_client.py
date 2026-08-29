"""国产 LLM API 封装（通义千问 / DeepSeek）。

- 通义千问：OpenAI 兼容模式
  https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
- DeepSeek：
  https://api.deepseek.com/v1/chat/completions

支持：
- complete()：一次性完整生成
- stream()：SSE 流式输出（async generator 逐段产出文本）
- estimate_tokens()：简单的 token 估算

API Key 缺失或网络异常时抛出 LLMError，由上层 try/except 降级处理。
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any, AsyncIterator, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

logger = logging.getLogger(__name__)

# 各 provider 的默认模型与端点（可用 LLM_BASE_URL / LLM_MODEL 全局覆盖）
_PROVIDERS: dict[str, dict[str, str]] = {
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    "sensenova": {
        "base_url": settings.sensenova_base_url,
        "model": settings.sensenova_model,
    },
}

# 中文字符范围，用于 token 估算
_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")


class LLMError(RuntimeError):
    """LLM 调用异常基类。"""


def estimate_tokens(text: str) -> int:
    """粗略估算 token 数量。

    中文大致 1 字 ≈ 1 token，英文约 3~4 字符 ≈ 1 token。
    仅用于提示词长度控制 / 成本估算，不追求精确。
    """
    if not text:
        return 0
    cjk_chars = len(_CJK_RE.findall(text))
    other_chars = len(text) - cjk_chars
    return cjk_chars + max(1, other_chars // 3)


class LLMClient:
    """国产 LLM 客户端（httpx 异步实现）。"""

    def __init__(
        self,
        provider: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        provider = (provider or settings.llm_provider).lower()
        if provider not in _PROVIDERS:
            logger.warning("未知 LLM provider=%s，回退到 qwen", provider)
            provider = "qwen"

        self.provider = provider
        # 支持全局覆盖：LLM_BASE_URL / LLM_MODEL 优先于 provider 默认值
        self.base_url = settings.llm_base_url or _PROVIDERS[provider]["base_url"]
        self.model = model or settings.llm_model or _PROVIDERS[provider]["model"]

        # 按 provider 取对应 API Key；LLM_API_KEY 为全局兜底
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = (
                settings.llm_api_key
                or {
                    "qwen": settings.qwen_api_key,
                    "deepseek": settings.deepseek_api_key,
                    "sensenova": settings.sensenova_api_key,
                }.get(provider, "")
            )

        self.timeout = timeout or settings.llm_timeout
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

    # ---------- 一次性生成 ----------
    @retry(
        wait=wait_exponential(multiplier=0.5, max=6),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def complete(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> str:
        """调用 chat/completions，返回生成的文本内容。

        Args:
            messages: OpenAI 格式消息列表，如
                [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
            model: 覆盖默认模型名。
            temperature: 采样温度。
            max_tokens: 最大生成长度。

        Returns:
            模型生成的文本；出错时抛出 LLMError。
        """
        if not self.api_key:
            raise LLMError("未配置 API Key（设置 SENSENOVA_API_KEY / QWEN_API_KEY / DEEPSEEK_API_KEY / LLM_API_KEY）")

        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        payload.update(kwargs)

        try:
            resp = await self._client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001 - 统一转为 LLMError
            logger.warning("LLM complete 失败（provider=%s）: %s", self.provider, exc)
            raise LLMError(f"LLM 调用失败: {exc}") from exc

    # ---------- 流式生成 ----------
    async def stream(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """SSE 流式生成，逐段产出文本增量。

        用法：async for delta in client.stream(messages): ...
        """
        if not self.api_key:
            raise LLMError("未配置 API Key（设置 SENSENOVA_API_KEY / QWEN_API_KEY / DEEPSEEK_API_KEY / LLM_API_KEY）")

        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        try:
            async with self._client.stream("POST", "/chat/completions", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        import json

                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                    except Exception:  # noqa: BLE001 - 忽略无法解析的分片
                        continue
        except Exception as exc:  # noqa: BLE001 - 统一转为 LLMError
            logger.warning("LLM stream 失败（provider=%s）: %s", self.provider, exc)
            raise LLMError(f"LLM 流式调用失败: {exc}") from exc

    # ---------- 工具方法 ----------
    async def close(self) -> None:
        """关闭底层 httpx 连接。"""
        await self._client.aclose()

    def __str__(self) -> str:  # pragma: no cover
        return f"LLMClient(provider={self.provider}, model={self.model})"
