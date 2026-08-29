"""知识库管理接口。

- POST /api/knowledge/upload：上传原始文档，存入 MinIO。
- POST /api/knowledge/ingest：提交异步摄取任务（分块 -> embedding -> Milvus）。
- GET  /api/knowledge/datasets：列出线上知识库（SenseCore 数据集）。
- POST /api/knowledge/datasets：创建线上知识库。
- DELETE /api/knowledge/datasets/{id}：删除线上知识库。
- POST /api/knowledge/chat：知识库问答（SenseCore RAG chat-release，非流式）。
- POST /api/knowledge/chat/stream：知识库问答（SSE 流式）。

MinIO / Redis / SenseCore 不可用时返回降级状态，不抛出 500。
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.sensecore_rag_client import SenseCoreConfigError, get_rag_client
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


class KnowledgeChatRequest(BaseModel):
    content: str
    conversation_id: str = ""


class KnowledgeChatSource(BaseModel):
    page_content: str = ""
    document_name: str = ""
    score: float = 0.0
    uri: str = ""


class KnowledgeChatResponse(BaseModel):
    answer: str = ""
    conversation_id: str = ""
    sources: list[KnowledgeChatSource] = []
    degraded: bool = False
    reason: str = ""


@router.post("/chat", response_model=KnowledgeChatResponse, summary="知识库问答（SenseCore RAG chat-release，非流式）")
async def knowledge_chat(payload: KnowledgeChatRequest) -> KnowledgeChatResponse:
    """调用 SenseCore 发布后会话接口进行知识库问答。"""
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="content 不能为空")

    result = await get_rag_client().chat(
        content=payload.content,
        conversation_id=payload.conversation_id,
        action=0,
    )
    if result is None:
        return KnowledgeChatResponse(
            degraded=True,
            reason="SenseCore RAG 调用失败或未配置（检查 SENSECORE_RELEASE_KEY / 鉴权配置）",
        )

    sources = []
    for item in result.get("knowledge_base_results") or []:
        doc = item.get("document") or {}
        sources.append(
            KnowledgeChatSource(
                page_content=item.get("page_content", ""),
                document_name=doc.get("display_name", ""),
                score=float(item.get("confidence", 0) or 0),
                uri=doc.get("uri", "") or item.get("uri", ""),
            )
        )

    return KnowledgeChatResponse(
        answer=result.get("message", ""),
        conversation_id=result.get("conversation_id", ""),
        sources=sources,
    )


@router.post("/chat/stream", summary="知识库问答（SSE 流式）")
async def knowledge_chat_stream(payload: KnowledgeChatRequest) -> StreamingResponse:
    """SSE 流式代理 SenseCore chat-release，前端按 'data: {json}' 逐块消费。"""
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="content 不能为空")

    async def event_source():
        try:
            client = get_rag_client()
            async for line in client.chat_stream(
                content=payload.content,
                conversation_id=payload.conversation_id,
                action=0,
            ):
                # 透传上游 SSE 行（含 data: {...} 与 keep-alive）
                yield f"{line}\n\n"
        except SenseCoreConfigError as exc:
            yield f"event: error\ndata: {{\"message\": {str(exc)!r}}}\n\n"
        except Exception as exc:  # noqa: BLE001 - 流式中断降级
            logger.warning("知识库流式问答异常（降级）: %s", exc)
            yield f"event: error\ndata: {{\"message\": {str(exc)!r}}}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------- 线上知识库（数据集）管理 ----------


class DatasetInfo(BaseModel):
    dataset_id: str = ""
    display_name: str = ""
    desc: str = ""
    state: int = 0
    is_empty: bool = True
    document_count: int = 0
    document_size: int = 0
    segment_count: int = 0
    token_count: int = 0


class DatasetListResponse(BaseModel):
    datasets: list[DatasetInfo] = []
    degraded: bool = False
    reason: str = ""


class DatasetCreateRequest(BaseModel):
    display_name: str
    desc: str = ""


class DatasetCreateResponse(BaseModel):
    dataset_id: str = ""
    display_name: str = ""
    degraded: bool = False
    reason: str = ""


class DatasetDeleteResponse(BaseModel):
    deleted: bool = False
    degraded: bool = False
    reason: str = ""


def _to_dataset_info(raw: dict[str, Any]) -> DatasetInfo:
    return DatasetInfo(
        dataset_id=raw.get("dataset_id", ""),
        display_name=raw.get("display_name", ""),
        desc=raw.get("desc", ""),
        state=int(raw.get("state", 0) or 0),
        is_empty=bool(raw.get("is_empty", True)),
        document_count=int(raw.get("document_count", 0) or 0),
        document_size=int(raw.get("document_size", 0) or 0),
        segment_count=int(raw.get("segment_count", 0) or 0),
        token_count=int(raw.get("token_count", 0) or 0),
    )


@router.get("/datasets", response_model=DatasetListResponse, summary="列出线上知识库（SenseCore 数据集）")
async def list_datasets() -> DatasetListResponse:
    try:
        items = await get_rag_client().list_datasets()
    except SenseCoreConfigError as exc:
        return DatasetListResponse(degraded=True, reason=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("列出知识库失败（降级）: %s", exc)
        return DatasetListResponse(degraded=True, reason=str(exc)[:120])
    return DatasetListResponse(datasets=[_to_dataset_info(i) for i in items])


@router.post("/datasets", response_model=DatasetCreateResponse, summary="创建线上知识库")
async def create_dataset(payload: DatasetCreateRequest) -> DatasetCreateResponse:
    name = payload.display_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="display_name 不能为空")
    try:
        data = await get_rag_client().create_dataset(name, payload.desc)
    except SenseCoreConfigError as exc:
        return DatasetCreateResponse(degraded=True, reason=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("创建知识库失败（降级）: %s", exc)
        return DatasetCreateResponse(degraded=True, reason=str(exc)[:120])
    if data is None:
        return DatasetCreateResponse(degraded=True, reason="SenseCore 创建知识库失败")
    return DatasetCreateResponse(
        dataset_id=data.get("dataset_id", ""),
        display_name=data.get("display_name", name),
    )


@router.delete("/datasets/{dataset_id}", response_model=DatasetDeleteResponse, summary="删除线上知识库")
async def delete_dataset(dataset_id: str) -> DatasetDeleteResponse:
    try:
        ok = await get_rag_client().delete_dataset(dataset_id)
    except SenseCoreConfigError as exc:
        return DatasetDeleteResponse(degraded=True, reason=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("删除知识库失败（降级）: %s", exc)
        return DatasetDeleteResponse(degraded=True, reason=str(exc)[:120])
    return DatasetDeleteResponse(deleted=ok, degraded=not ok, reason="" if ok else "SenseCore 删除知识库失败")


class DocumentInfo(BaseModel):
    document_id: str = ""
    display_name: str = ""
    type: int = 0
    document_size: int = 0
    token_count: int = 0
    segment_count: int = 0
    uri: str = ""
    create_time: str = ""


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo] = []
    degraded: bool = False
    reason: str = ""


class DocumentDeleteResponse(BaseModel):
    deleted: bool = False
    degraded: bool = False
    reason: str = ""


@router.get(
    "/datasets/{dataset_id}/documents",
    response_model=DocumentListResponse,
    summary="列出线上知识库中的文档",
)
async def list_dataset_documents(dataset_id: str) -> DocumentListResponse:
    try:
        items = await get_rag_client().list_documents(dataset_id)
    except SenseCoreConfigError as exc:
        return DocumentListResponse(degraded=True, reason=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("列出知识库文档失败（降级）: %s", exc)
        return DocumentListResponse(degraded=True, reason=str(exc)[:120])
    return DocumentListResponse(
        documents=[
            DocumentInfo(
                document_id=i.get("document_id", ""),
                display_name=i.get("display_name", ""),
                type=int(i.get("type", 0) or 0),
                document_size=int(i.get("document_size", 0) or 0),
                token_count=int(i.get("token_count", 0) or 0),
                segment_count=int(i.get("segment_count", 0) or 0),
                uri=i.get("uri", ""),
                create_time=str(i.get("create_time") or ""),
            )
            for i in items
        ]
    )


@router.delete(
    "/datasets/{dataset_id}/documents/{document_id}",
    response_model=DocumentDeleteResponse,
    summary="删除线上知识库中的文档",
)
async def delete_dataset_document(dataset_id: str, document_id: str) -> DocumentDeleteResponse:
    try:
        ok = await get_rag_client().delete_document(dataset_id, document_id)
    except SenseCoreConfigError as exc:
        return DocumentDeleteResponse(degraded=True, reason=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("删除知识库文档失败（降级）: %s", exc)
        return DocumentDeleteResponse(degraded=True, reason=str(exc)[:120])
    return DocumentDeleteResponse(deleted=ok, degraded=not ok, reason="" if ok else "SenseCore 删除文档失败")


class DatasetUploadResponse(BaseModel):
    job_id: str = ""
    dataset_id: str = ""
    filename: str = ""
    status: str  # "ok" | "degraded"
    message: str = ""


@router.post(
    "/datasets/{dataset_id}/documents",
    response_model=DatasetUploadResponse,
    summary="上传文档到线上知识库（创建导入任务 -> 预签名直传 -> 启动任务）",
)
async def upload_dataset_document(
    dataset_id: str,
    file: UploadFile = File(...),
) -> DatasetUploadResponse:
    """把本地文件导入 SenseCore 线上知识库，由云端完成解析、分段与向量化。"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="文件内容为空")
    try:
        result = await get_rag_client().import_file(dataset_id, file.filename, data)
    except SenseCoreConfigError as exc:
        return DatasetUploadResponse(status="degraded", message=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.warning("上传文档到线上知识库失败（降级）: %s", exc)
        return DatasetUploadResponse(
            status="degraded", message=f"上传失败: {str(exc)[:200]}"
        )
    return DatasetUploadResponse(
        job_id=result["job_id"],
        dataset_id=result["dataset_id"],
        filename=result["filename"],
        status="ok",
        message="已上传并启动知识导入任务，云端解析中",
    )
