"""术前谈话分析接口。

POST /api/preop/analyze

流程：合规过滤 -> PHI 脱敏 -> RAG 混合检索（补充既往资料上下文）
-> LLM 生成结构化术前分析 -> 结果还原（若含 PHI）。

返回：surgery（拟手术）、risks（风险）、alternatives（替代方案）、
consent（知情同意要点）、missing_items（缺失项）、score（完整度评分 0-100）。
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..desensitize import desensitize, restore
from ..guardrails.filters import check
from ..rag.retrieval import hybrid_search
from ..services.llm_client import LLMClient, LLMError
from ._common import parse_llm_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/preop", tags=["preop"])

# 提示词模板（system）
_SYSTEM_PROMPT = (
    "你是一名资深外科医生，负责评估术前谈话记录。请阅读患者术前谈话文本，"
    "输出严格的 JSON 对象，字段如下：\n"
    "{\"surgery\": \"拟实施手术名称\", "
    "\"risks\": [\"风险项1\", ...], "
    "\"alternatives\": [\"替代方案1\", ...], "
    "\"consent\": \"知情同意要点概述\", "
    "\"missing_items\": [\"缺失或需补充项1\", ...], "
    "\"score\": 0-100 的整数，代表谈话完整度}\n"
    "只输出 JSON，不要输出其他内容。"
)


class PreopAnalyzeRequest(BaseModel):
    text: str
    model: str | None = None


class PreopAnalyzeResponse(BaseModel):
    surgery: str = ""
    risks: list[str] = []
    alternatives: list[str] = []
    consent: str = ""
    missing_items: list[str] = []
    score: float = 0.0
    degraded: bool = False
    reason: str = ""


def _fallback_score(missing_items: list[str]) -> float:
    """无 LLM 时依据缺失项数量估算完整度。"""
    return max(0.0, 100.0 - 20.0 * len(missing_items))


@router.post("/analyze", response_model=PreopAnalyzeResponse, summary="术前谈话结构化分析")
async def analyze_preop(payload: PreopAnalyzeRequest) -> PreopAnalyzeResponse:
    # 1) 合规过滤
    result = check(payload.text)
    if not result.allowed:
        raise HTTPException(status_code=400, detail=f"输入未通过合规检查: {result.reason}")

    # 2) PHI 脱敏（LLM 与检索不接触明文隐私）
    masked, mapping = desensitize(payload.text)

    # 3) RAG 检索（Milvus 不可用时自动降级为空上下文）
    context_docs = []
    try:
        hits = hybrid_search(masked, corpus=None, top_k=5)
        context_docs = [h["text"] for h in hits]
    except Exception as exc:  # noqa: BLE001 - 检索失败降级
        logger.warning("preop 检索降级: %s", exc)
    context = "\n".join(f"- {d}" for d in context_docs) if context_docs else "（无）"

    user_prompt = (
        f"以下是术前谈话记录（已脱敏）：\n{masked}\n\n"
        f"可参考的既往资料上下文：\n{context}\n\n"
        "请输出上述 JSON 结构。"
    )

    # 4) LLM 生成
    client = LLMClient(model=payload.model)
    try:
        raw = await client.complete(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
    except LLMError as exc:
        logger.warning("preop LLM 调用失败，返回降级结果: %s", exc)
        reason = (
            "模型调用被限流或配额耗尽（429），请稍后在平台提升配额"
            if "429" in str(exc)
            else f"AI 服务暂不可用：{str(exc)[:120]}"
        )
        return PreopAnalyzeResponse(score=0.0, degraded=True, reason=reason)
    finally:
        await client.close()

    data = parse_llm_json(raw, default={})
    if not isinstance(data, dict):
        data = {}

    # 5) 还原脱敏字段
    def _restore_value(value: Any) -> Any:
        if isinstance(value, str):
            return restore(value, mapping)
        return value

    risks = [_restore_value(r) for r in data.get("risks", []) if isinstance(r, str)]
    alternatives = [_restore_value(a) for a in data.get("alternatives", []) if isinstance(a, str)]
    missing = [m for m in data.get("missing_items", []) if isinstance(m, str)]
    score = data.get("score", 0)

    return PreopAnalyzeResponse(
        surgery=_restore_value(data.get("surgery", "")) or "",
        risks=risks,
        alternatives=alternatives,
        consent=_restore_value(data.get("consent", "")) or "",
        missing_items=missing,
        score=float(score) if isinstance(score, (int, float)) else _fallback_score(missing),
    )
