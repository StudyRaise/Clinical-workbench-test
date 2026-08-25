"""RxNorm 药物编码标准化（占位骨架）。

RxNorm 为美国药典命名标准，此处仅提供接口骨架与示例映射，
后续可接入 RxNorm API（RxNav）或本地 RRF 词库。
"""
from __future__ import annotations

from typing import Any

# 示例：中文药物 -> RxNorm RxCUI（占位）
_RXNORM_DICT: dict[str, dict[str, Any]] = {
    "阿司匹林": {"code": "1191", "description": "aspirin"},
    "二甲双胍": {"code": "1596456", "description": "metformin"},
    "阿托伐他汀": {"code": "83367", "description": "atorvastatin"},
    "氯吡格雷": {"code": "32968", "description": "clopidogrel"},
}


def match_term(term: str) -> dict[str, Any] | None:
    """匹配药物到 RxNorm 编码。

    Returns:
        {"term": ..., "code": RxCUI, "description": ..., "confidence": ...}；
        未命中返回 None。
    """
    if not term:
        return None
    if term in _RXNORM_DICT:
        item = _RXNORM_DICT[term]
        return {"term": term, "code": item["code"], "description": item["description"], "confidence": 1.0}
    return None


def normalize(text: str) -> list[dict[str, Any]]:
    """从文本中匹配 RxNorm 编码（占位实现）。"""
    if not text:
        return []
    results = []
    for term in _RXNORM_DICT:
        if term in text:
            matched = match_term(term)
            if matched:
                results.append(matched)
    return results
