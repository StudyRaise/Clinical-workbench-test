"""文档摄取任务：分块 -> embedding -> Milvus 入库。

工作流程：
1. 从 MinIO 下载原始文档（object_name 定位）。
2. 按文件类型解析文本（PDF / DOCX / 纯文本）。
3. 文本分块（RecursiveCharacterTextSplitter 风格）。
4. 向量化（text-embedding-v2，无 Key 时降级伪向量）。
5. 写入 Milvus 集合。

任何一步失败均被捕获，任务返回结构化状态而非抛出异常，
便于通过结果后端追踪失败原因。
"""
from __future__ import annotations

import io
import logging
from typing import Any

from ..config import settings
from ..rag.chunking import split_text
from ..rag.embedding import EmbeddingClient
from celery.exceptions import Retry

from ..utils.milvus_client import MilvusClient
from ..utils.minio_client import MinioClient
from .celery_app import celery_app

logger = logging.getLogger(__name__)


def _extract_text(object_name: str, data: bytes) -> str:
    """按扩展名解析文档为纯文本（降级模式返回空串）。"""
    name = object_name.lower()
    try:
        if name.endswith(".pdf"):
            try:
                from pypdf import PdfReader

                reader = PdfReader(io.BytesIO(data))
                return "\n".join(page.extract_text() or "" for page in reader.pages)
            except ImportError:
                logger.warning("pypdf 未安装，无法解析 PDF")
                return ""
        if name.endswith(".docx"):
            try:
                import docx

                doc = docx.Document(io.BytesIO(data))
                return "\n".join(p.text for p in doc.paragraphs)
            except ImportError:
                logger.warning("python-docx 未安装，无法解析 DOCX")
                return ""
        if name.endswith((".txt", ".md", ".json", ".csv")):
            return data.decode("utf-8", errors="ignore")
    except Exception as exc:  # noqa: BLE001 - 文档解析失败降级
        logger.warning("文档解析失败 %s（降级）: %s", object_name, exc)
        return ""
    return ""


@celery_app.task(name="tasks.ingest_document", bind=True, max_retries=2)
def ingest_document(
    self,
    object_name: str,
    bucket: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """摄取单个文档：下载 -> 解析 -> 分块 -> 向量化 -> 入库。

    Args:
        object_name: MinIO 中的对象名（如 docs/xxx.pdf）。
        bucket: MinIO bucket，默认使用配置。
        metadata: 附加元数据（如时间、来源、科室）。

    Returns:
        任务状态字典：{"status": "ok"|"error", "object_name", "chunks", ...}。
    """
    try:
        meta = dict(metadata or {})
        minio = MinioClient()
        data = minio.download(object_name, bucket)
        if data is None:
            return {"status": "error", "object_name": object_name, "error": "MinIO 下载失败（服务不可用或对象不存在）"}

        text = _extract_text(object_name, data)
        if not text.strip():
            return {"status": "error", "object_name": object_name, "error": "文档解析结果为空"}

        # 分块
        chunks = split_text(text)
        if not chunks:
            return {"status": "error", "object_name": object_name, "error": "分块结果为空"}

        # 向量化
        emb = EmbeddingClient()
        vectors = emb.embed_documents(chunks)

        # 入库
        milvus = MilvusClient()
        milvus.create_collection()
        metadatas = [
            {**meta, "source": object_name, "chunk_index": i} for i in range(len(chunks))
        ]
        ok = milvus.insert(chunks, vectors, metadatas)
        if not ok:
            return {"status": "error", "object_name": object_name, "error": "Milvus 入库失败（服务不可用或降级模式）"}

        return {
            "status": "ok",
            "object_name": object_name,
            "chunks": len(chunks),
            "dim": settings.embedding_dim,
        }
    except Exception as exc:  # noqa: BLE001 - 任务级兜底
        logger.exception("ingest_document 失败: %s", object_name)
        try:
            raise self.retry(exc=exc, countdown=5)
        except Retry:
            raise  # 交给 Celery 调度重试
        except Exception as retry_exc:  # noqa: BLE001 - 重试耗尽，返回错误状态
            return {"status": "error", "object_name": object_name, "error": str(retry_exc)}
