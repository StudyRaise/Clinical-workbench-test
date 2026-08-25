"""ICD-10 基础编码字典与匹配函数。

内置常用诊断的「中文术语 -> ICD-10 编码」映射（示例子集），
提供 normalize() 将文本中的诊断术语匹配为标准化编码。

完整词表可替换 / 扩展为 ICD-10 官方库或接入数据库表。
"""
from __future__ import annotations

import re
from typing import Any

# 常用 ICD-10 编码字典：term -> (code, 描述)
ICD10_DICT: dict[str, tuple[str, str]] = {
    "高血压": ("I10", "原发性高血压"),
    "2型糖尿病": ("E11", "2型糖尿病"),
    "糖尿病": ("E14", "未特指的糖尿病"),
    "冠心病": ("I25", "慢性缺血性心脏病"),
    "脑梗死": ("I63", "脑梗死"),
    "肺炎": ("J18", "病原体未特指的肺炎"),
    "缺铁性贫血": ("D50", "缺铁性贫血"),
    "高脂血症": ("E78", "脂蛋白代谢紊乱及其他脂血症"),
    "心力衰竭": ("I50", "心力衰竭"),
    "急性阑尾炎": ("K35", "急性阑尾炎"),
    "骨折": ("S42", "肩胛带骨折"),
    "上呼吸道感染": ("J06", "多个部位急性上呼吸道感染"),
    "慢性阻塞性肺病": ("J44", "慢性阻塞性肺病"),
    "胃炎": ("K29", "胃炎和十二指肠炎"),
}

# 拼音 / 英文别名（占位，可扩展）
_ALIASES: dict[str, str] = {
    "HTN": "高血压",
    "DM": "糖尿病",
    "COPD": "慢性阻塞性肺病",
    "CAP": "肺炎",
}


def match_term(term: str) -> dict[str, Any] | None:
    """匹配单个术语。

    Args:
        term: 诊断术语文本。

    Returns:
        {"term": 原词, "code": ICD-10 编码, "description": 描述, "confidence": 置信度}；
        未命中返回 None。
    """
    term = term.strip()
    if not term:
        return None
    term = _ALIASES.get(term.upper(), term)
    if term in ICD10_DICT:
        code, desc = ICD10_DICT[term]
        return {"term": term, "code": code, "description": desc, "confidence": 1.0}
    # 子串匹配（如「高血压3级」）
    for key, (code, desc) in ICD10_DICT.items():
        if key in term:
            return {"term": term, "code": code, "description": desc, "confidence": 0.8}
    return None


def normalize(text: str) -> list[dict[str, Any]]:
    """从自由文本中抽取诊断术语并标准化为 ICD-10 编码。

    Args:
        text: 病历 / 诊断文本。

    Returns:
        命中的编码列表（按出现顺序去重）。
    """
    if not text:
        return []
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for key in ICD10_DICT:
        if re.search(re.escape(key), text):
            matched = match_term(key)
            if matched and matched["code"] not in seen:
                seen.add(matched["code"])
                results.append(matched)
    return results
