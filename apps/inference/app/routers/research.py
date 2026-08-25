"""科研数据清洗 / 结构化抽取接口。

POST /api/research/clean

流程（逐条）：合规过滤 -> PHI 脱敏 -> Schema-aware 字段字典检索
-> LLM 抽取结构化字段（含置信度）-> 还原。

返回：每条文本对应的结构化字段表 + 置信度。
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..desensitize import desensitize, restore
from ..guardrails.filters import check
from ..rag.schema_aware import SchemaAwareRetriever, SchemaRegistry
from ..services.llm_client import LLMClient, LLMError
from ._common import parse_llm_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/research", tags=["research"])

_SYSTEM_PROMPT = (
    "你是临床科研数据抽取助手。请从给定的文本中抽取结构化字段，"
    "输出严格的 JSON 数组，每项结构如下：\n"
    "{\"field\": \"字段名\", \"value\": \"抽取值（无则空串）\", \"confidence\": 0-1 的小数}\n"
    "字段名必须取自给定的变量字典。只输出 JSON 数组，不要输出其他内容。"
)

# 复用默认临床变量字典
_retriever = SchemaAwareRetriever(SchemaRegistry())


class ResearchCleanRequest(BaseModel):
    texts: list[str]
    model: str | None = None


class FieldExtraction(BaseModel):
    field: str
    value: str = ""
    confidence: float = 0.0


class RecordExtraction(BaseModel):
    source_index: int
    fields: list[FieldExtraction] = []


class ResearchCleanResponse(BaseModel):
    schema_fields: list[str] = []
    records: list[RecordExtraction] = []


def _extract_fields(raw: Any) -> list[dict[str, Any]]:
    """将 LLM 输出（JSON 数组或对象）规整为字段列表。"""
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    fields: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field", "")).strip()
        if not field:
            continue
        conf = item.get("confidence", 0.0)
        fields.append(
            {
                "field": field,
                "value": str(item.get("value", "")),
                "confidence": float(conf) if isinstance(conf, (int, float)) else 0.0,
            }
        )
    return fields


@router.post("/clean", response_model=ResearchCleanResponse, summary="科研文本结构化清洗")
async def clean_research(payload: ResearchCleanRequest) -> ResearchCleanResponse:
    # 任一输入违规直接拒绝
    for text in payload.texts:
        result = check(text)
        if not result.allowed:
            raise HTTPException(status_code=400, detail=f"存在未通过合规检查的输入: {result.reason}")

    # Schema-aware 字段字典（以所有输入拼接后的查询为例）
    joined = "\n".join(payload.texts)
    schema_info = _retriever.retrieve(joined, top_k_fields=8)
    schema_text = schema_info["schema_text"] or "（无匹配字段，请自由抽取常见临床指标）"

    client = LLMClient(model=payload.model)
    records: list[RecordExtraction] = []
    try:
        for idx, text in enumerate(payload.texts):
            masked, mapping = desensitize(text)
            user_prompt = (
                f"变量字典：\n{schema_text}\n\n"
                f"文本（已脱敏）：\n{masked}\n\n请输出 JSON 数组。"
            )
            try:
                raw = await client.complete(
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.0,
                )
                fields = _extract_fields(parse_llm_json(raw, default=[]))
            except LLMError as exc:
                logger.warning("research 单条 LLM 失败（跳过）: %s", exc)
                fields = []
            # 还原字段值中的 PHI
            fields = [
                {**f, "value": restore(f["value"], mapping)}
                for f in fields
            ]
            records.append(
                RecordExtraction(
                    source_index=idx,
                    fields=[FieldExtraction(**f) for f in fields],
                )
            )
    finally:
        await client.close()

    return ResearchCleanResponse(
        schema_fields=[f.name for f in schema_info["fields"]],
        records=records,
    )
