"""脱敏还原器：根据映射表把占位符替换回原文。

映射表由 masker 生成：{"[手机号]": "13800000000", ...}。
若某占位符在映射表中不存在，保持原样不做替换（安全兜底）。
"""
from __future__ import annotations

import re


def restore(masked_text: str, mapping: dict[str, str]) -> str:
    """将脱敏文本中的占位符还原为原文。

    Args:
        masked_text: 脱敏后的文本。
        mapping: 占位符 -> 原文 的映射表。

    Returns:
        还原后的文本。
    """
    if not masked_text or not mapping:
        return masked_text

    result = masked_text
    # 优先替换带序号的占位符（如 [手机号2]），避免被 [手机号] 前缀截断
    for placeholder in sorted(mapping.keys(), key=len, reverse=True):
        original = mapping[placeholder]
        result = result.replace(placeholder, original)
    return result
