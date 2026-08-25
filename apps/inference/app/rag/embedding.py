"""向量化：通义千问 text-embedding-v2 封装。

使用 DashScope 原生文本向量化接口（httpx 同步调用）：
    POST https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding
    model: text-embedding-v2，输出维度 1024。

无 API Key 或网络失败时降级为确定性伪向量（同一文本恒等），
保证 RAG 管线骨架在无外部服务时可运行。
"""
from __future__ import annotations

import hashlib
import logging
import math
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings

logger = logging.getLogger(__name__)

_EMBEDDING_URL = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"
_MAX_BATCH = 10  # 单次请求最大文本数（text-embedding-v2 限制）


class EmbeddingError(RuntimeError):
    """向量化调用异常基类。"""


def _pseudo_embedding(text: str, dim: int | None = None) -> list[float]:
    """确定性伪向量（降级模式）：由文本哈希 + 字符分布生成，维度固定。"""
    dim = dim or settings.embedding_dim
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vec: list[float] = []
    for i in range(dim):
        seed = digest[i % len(digest)]
        h = hashlib.sha256(f"{text}:{i}".encode("utf-8")).digest()
        v = (int.from_bytes(h[:4], "big") / 0xFFFFFFFF) * 2 - 1
        vec.append(v)
    # 归一化，保证余弦相似度可用
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


class EmbeddingClient:
    """通义千问 text-embedding-v2 客户端。"""

    def __init__(self, api_key: str | None = None, dim: int | None = None) -> None:
        self.api_key = api_key or settings.embedding_api_key
        self.model = settings.embedding_model
        self.dim = dim or settings.embedding_dim
        self._client = httpx.Client(timeout=60.0)

    @retry(wait=wait_exponential(multiplier=0.5, max=6), stop=stop_after_attempt(3), reraise=True)
    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        resp = self._client.post(_EMBEDDING_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def embed_documents(self, texts: list[str], batch_size: int | None = None) -> list[list[float]]:
        """批量向量化文档文本。

        Args:
            texts: 文本列表。
            batch_size: 每批数量，默认 _MAX_BATCH。

        Returns:
            与输入一一对应的向量列表。API 不可用时返回伪向量。
        """
        if not texts:
            return []
        if not self.api_key:
            logger.warning("未配置 EMBEDDING_API_KEY，使用伪向量降级模式")
            return [_pseudo_embedding(t, self.dim) for t in texts]

        batch = batch_size or _MAX_BATCH
        results: list[list[float]] = []
        for i in range(0, len(texts), batch):
            chunk = texts[i : i + batch]
            try:
                payload = {
                    "model": self.model,
                    "input": {"texts": chunk},
                    "parameters": {"text_type": "document", "dimension": self.dim},
                }
                data = self._post(payload)
                emb_map = {
                    item["text_index"]: item["embedding"]
                    for item in data.get("output", {}).get("embeddings", [])
                }
                batch_vecs = [emb_map.get(idx, _pseudo_embedding(t, self.dim)) for idx, t in enumerate(chunk)]
                results.extend(batch_vecs)
            except Exception as exc:  # noqa: BLE001 - 外部服务降级
                logger.warning("embed_documents 失败（降级为伪向量）: %s", exc)
                results.extend(_pseudo_embedding(t, self.dim) for t in chunk)
        return results

    def embed_query(self, text: str) -> list[float]:
        """向量化单个查询文本（text_type=query）。"""
        if not self.api_key:
            return _pseudo_embedding(text, self.dim)
        try:
            payload = {
                "model": self.model,
                "input": {"texts": [text]},
                "parameters": {"text_type": "query", "dimension": self.dim},
            }
            data = self._post(payload)
            items = data.get("output", {}).get("embeddings", [])
            if items:
                return items[0]["embedding"]
            return _pseudo_embedding(text, self.dim)
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("embed_query 失败（降级为伪向量）: %s", exc)
            return _pseudo_embedding(text, self.dim)

    def close(self) -> None:
        """关闭底层连接。"""
        self._client.close()


# 模块级默认实例
embedding_client = EmbeddingClient()
