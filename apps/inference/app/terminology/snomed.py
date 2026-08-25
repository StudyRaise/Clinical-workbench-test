"""SNOMED CT 术语标准化（占位骨架）。

SNOMED CT 为国际化临床术语标准，此处仅提供接口骨架与示例映射，
后续可接入 SNOMED 官方发布包 / 术语服务 API。
"""
from __future__ import annotations

from typing import Any

# 示例：中文术语 -> SNOMED CT 概念 ID（占位）
_SNOMED_DICT: dict[str, dict[str, Any]] = {
    "高血压": {"code": "38341003", "description": "Hypertensive disorder"},
    "糖尿病": {"code": "73211009", "description": "Diabetes mellitus"},
    "肺炎": {"code": "233604007", "description": "Pneumonia"},
}


def match_term(term: str) -> dict[str, Any] | None:
    """匹配术语到 SNOMED CT 编码。

    Returns:
        {"term": ..., "code": ..., "description": ..., "confidence": ...}；
        未命中返回 None。
    """
    if not term:
        return None
    if term in _SNOMED_DICT:
        item = _SNOMED_DICT[term]
        return {"term": term, "code": item["code"], "description": item["description"], "confidence": 1.0}
    return None


def normalize(text: str) -> list[dict[str, Any]]:
    """从文本中匹配 SNOMED CT 编码（占位实现）。"""
    if not text:
        return []
    results = []
    for term in _SNOMED_DICT:
        if term in text:
            matched = match_term(term)
            if matched:
                results.append(matched)
    return results
