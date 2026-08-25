"""知识库管理接口。

- POST /api/knowledge/upload：上传原始文档，存入 MinIO。
- POST /api/knowledge/ingest：提交异步摄取任务（分块 -> embedding -> Milvus）。

MinIO / Redis 不可用时返回降级状态，不抛出 500。
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..utils.minio_client import minio_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KnowledgeUploadResponse(BaseModel):
    object_name: str
    status: str  # "ok" | "degraded"
    message: str = ""


class KnowledgeIngestRequest(BaseModel):
    object_name: str
    bucket: str | None = None
    metadata: dict[str, Any] | None = None


class KnowledgeIngestResponse(BaseModel):
    task_id: str = ""
    status: str  # "submitted" | "degraded"
    message: str = ""


@router.post("/upload", response_model=KnowledgeUploadResponse, summary="上传知识文档（存入 MinIO）")
async def upload_knowledge(
    file: UploadFile = File(...),
    bucket: str | None = Form(None),
) -> KnowledgeUploadResponse:
    """上传文件到 MinIO。文件名需携带扩展名（.pdf/.docx/.txt/.md）以支持后续解析。"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")

    data = await file.read()
    object_name = f"docs/{uuid.uuid4().hex}-{file.filename}"

    try:
        ok = minio_client.upload_file(
            object_name,
            data,
            content_type=file.content_type or "application/octet-stream",
            bucket=bucket,
        )
    except Exception as exc:  # noqa: BLE001 - 外部服务降级
        logger.warning("知识库上传失败（降级）: %s", exc)
        return KnowledgeUploadResponse(
            object_name=object_name,
            status="degraded",
            message=f"MinIO 不可用，未实际存储: {exc}",
        )

    return KnowledgeUploadResponse(
        object_name=object_name,
        status="ok" if ok else "degraded",
        message="" if ok else "MinIO 不可用或降级模式，未实际存储",
    )


@router.post("/ingest", response_model=KnowledgeIngestResponse, summary="提交文档异步摄取任务")
async def ingest_knowledge(payload: KnowledgeIngestRequest) -> KnowledgeIngestResponse:
    """提交 Celery 异步任务进行文档摄取（分块 -> 向量化 -> Milvus 入库）。"""
    if not payload.object_name:
        raise HTTPException(status_code=400, detail="缺少 object_name")

    try:
        from ..tasks.ingest import ingest_document

        task = ingest_document.delay(
            object_name=payload.object_name,
            bucket=payload.bucket,
            metadata=payload.metadata or {},
        )
    except Exception as exc:  # noqa: BLE001 - Redis 不可用时降级
        logger.warning("知识库摄取任务提交失败（降级）: %s", exc)
        return KnowledgeIngestResponse(
            status="degraded",
            message=f"任务队列不可用，未提交: {exc}",
        )

    return KnowledgeIngestResponse(task_id=task.id, status="submitted")
