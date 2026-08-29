"""Milvus 向量数据库客户端封装。

提供连接、建集合（collection）、向量入库与检索能力。
连接 / 集合不存在等异常统一降级为可用性标记，避免阻塞服务启动。
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from ..config import settings

logger = logging.getLogger(__name__)

try:
    from pymilvus import (
        Collection,
        CollectionSchema,
        DataType,
        FieldSchema,
        connections,
        utility,
    )
    _PYMILVUS_AVAILABLE = True
except ImportError:  # pragma: no cover - 依赖缺失时降级
    _PYMILVUS_AVAILABLE = False
    logger.warning("pymilvus 未安装，Milvus 客户端将以降级模式运行")
    connections = None
    utility = None
    DataType = None
    FieldSchema = None
    CollectionSchema = None
    Collection = None


class MilvusClient:
    """Milvus 轻量封装，全部异常就地捕获。"""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        collection_name: str | None = None,
    ) -> None:
        self.host = host or settings.milvus_host
        self.port = port or settings.milvus_port
        self.collection_name = collection_name or settings.milvus_collection
        self.connected = False
        self.collection: Optional[Any] = None
        self._connect()

    def _connect(self) -> None:
        """尝试建立连接；失败仅告警，不抛出（降级模式）。"""
        if not _PYMILVUS_AVAILABLE:
            return
        try:
            connections.connect(alias="default", host=self.host, port=self.port)
            self.connected = True
            logger.info("Milvus 连接成功: %s:%s", self.host, self.port)
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            self.connected = False
            logger.warning("Milvus 连接失败（降级模式）: %s", exc)

    def create_collection(self, embedding_dim: int | None = None) -> bool:
        """创建向量集合（不存在时），并确保向量字段已建索引。

        Args:
            embedding_dim: 向量维度，默认取配置 EMBEDDING_DIM。

        Returns:
            是否创建成功；连接不可用或已存在返回 True（幂等）。
        """
        if not _PYMILVUS_AVAILABLE or not self.connected:
            return False
        dim = embedding_dim or settings.embedding_dim
        try:
            if utility.has_collection(self.collection_name):
                logger.info("Milvus 集合已存在: %s", self.collection_name)
                self._ensure_index()
                return True
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=dim),
                FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=8192),
                FieldSchema(name="metadata", dtype=DataType.JSON),
            ]
            schema = CollectionSchema(fields, description="RAG 文档分块向量")
            Collection(self.collection_name, schema)
            logger.info("Milvus 集合创建成功: %s (dim=%d)", self.collection_name, dim)
            self._ensure_index()
            return True
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("Milvus 创建集合失败（降级模式）: %s", exc)
            return False

    def _ensure_index(self) -> None:
        """确保向量字段已建索引。

        Milvus 必须先为向量字段建索引才能 load / search，
        否则报 code=700 index not found。幂等：已有索引则跳过。
        """
        if not _PYMILVUS_AVAILABLE or not self.connected:
            return
        try:
            collection = Collection(self.collection_name)
            if collection.has_index():
                return
            index_params = {
                "index_type": "HNSW",
                "metric_type": "COSINE",
                "params": {"M": 8, "efConstruction": 64},
            }
            collection.create_index(field_name="vector", index_params=index_params)
            logger.info("Milvus 索引创建成功: %s (HNSW/COSINE)", self.collection_name)
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("Milvus 创建索引失败（降级模式）: %s", exc)

    def insert(self, texts: list[str], vectors: list[list[float]], metadatas: list[dict] | None = None) -> bool:
        """批量写入向量。

        Args:
            texts: 原始文本列表。
            vectors: 与 texts 一一对应的向量列表。
            metadatas: 每条记录的元数据（时间、来源等）。

        Returns:
            是否写入成功。
        """
        if not _PYMILVUS_AVAILABLE or not self.connected:
            return False
        try:
            collection = Collection(self.collection_name)
            self._ensure_index()
            metas = metadatas or [{} for _ in texts]
            data = [
                {"vector": vec, "text": text, "metadata": meta}
                for vec, text, meta in zip(vectors, texts, metas)
            ]
            collection.insert(data)
            collection.flush()
            return True
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("Milvus 写入失败（降级模式）: %s", exc)
            return False

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        expr: str | None = None,
    ) -> list[dict[str, Any]]:
        """向量相似度检索。

        Args:
            query_vector: 查询向量。
            top_k: 返回条数。
            expr: 过滤表达式（如时间范围），可选。

        Returns:
            命中记录列表：[{"text": ..., "metadata": ..., "score": ...}]。
            连接不可用或异常时返回空列表。
        """
        if not _PYMILVUS_AVAILABLE or not self.connected:
            return []
        try:
            collection = Collection(self.collection_name)
            self._ensure_index()
            collection.load()
            results = collection.search(
                data=[query_vector],
                anns_field="vector",
                param={"metric_type": "COSINE", "params": {"ef": 64}},
                limit=top_k,
                output_fields=["text", "metadata"],
                expr=expr,
            )
            hits: list[dict[str, Any]] = []
            for hit in results[0]:
                entity = hit.entity or {}
                hits.append(
                    {
                        "text": entity.get("text", ""),
                        "metadata": entity.get("metadata", {}),
                        "score": float(hit.score),
                    }
                )
            return hits
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("Milvus 检索失败（降级模式）: %s", exc)
            return []

    def count(self) -> int:
        """返回集合内向量条数（用于健康检查 / 日志）。"""
        if not _PYMILVUS_AVAILABLE or not self.connected:
            return 0
        try:
            collection = Collection(self.collection_name)
            return int(collection.num_entities)
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("Milvus 计数失败（降级模式）: %s", exc)
            return 0


# 模块级默认实例，可直接复用
milvus_client = MilvusClient()
