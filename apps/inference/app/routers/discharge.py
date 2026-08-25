"""出院小结生成接口。

POST /api/discharge/summarize

流程：合规过滤 -> PHI 脱敏 -> LLM 生成出院指导 -> 还原。
返回：patient_guide（患者版出院指导）、doctor_plan（医生随访计划）、
followup_date（复诊 / 随访时间建议）。
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..desensitize import desensitize, restore
from ..guardrails.filters import check
from ..services.llm_client import LLMClient, LLMError
from ._common import parse_llm_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discharge", tags=["discharge"])

_SYSTEM_PROMPT = (
    "你是一名主治医生，负责将出院记录转化为通俗易懂的出院指导。"
    "输出严格的 JSON 对象，字段如下：\n"
    "{\"patient_guide\": \"患者版出院指导（用药、饮食、活动、注意事项，通俗易懂）\", "
    "\"doctor_plan\": \"医生随访计划（复诊安排、需复查项目）\", "
    "\"followup_date\": \"建议复诊时间（如：出院后2周）\"}\n"
    "只输出 JSON，不要输出其他内容。"
)


class DischargeSummarizeRequest(BaseModel):
    text: str
    model: str | None = None


class DischargeSummarizeResponse(BaseModel):
    patient_guide: str = ""
    doctor_plan: str = ""
    followup_date: str = ""


@router.post("/summarize", response_model=DischargeSummarizeResponse, summary="出院小结生成")
async def summarize_discharge(payload: DischargeSummarizeRequest) -> DischargeSummarizeResponse:
    # 1) 合规过滤
    result = check(payload.text)
    if not result.allowed:
        raise HTTPException(status_code=400, detail=f"输入未通过合规检查: {result.reason}")

    # 2) PHI 脱敏
    masked, mapping = desensitize(payload.text)

    user_prompt = f"以下是出院记录（已脱敏）：\n{masked}\n\n请输出上述 JSON 结构。"

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
        logger.warning("discharge LLM 调用失败，返回降级结果: %s", exc)
        return DischargeSummarizeResponse()
    finally:
        await client.close()

    data = parse_llm_json(raw, default={})
    if not isinstance(data, dict):
        data = {}

    return DischargeSummarizeResponse(
        patient_guide=restore(str(data.get("patient_guide", "")), mapping),
        doctor_plan=restore(str(data.get("doctor_plan", "")), mapping),
        followup_date=restore(str(data.get("followup_date", "")), mapping),
    )
