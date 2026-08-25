"""PHI 脱敏工具包。

对外导出两个函数：
    desensitize(text) -> (masked_text, mapping)   # 脱敏并返回映射表
    restore(text, mapping) -> original_text       # 依据映射表还原
"""
from __future__ import annotations

from .masker import mask as _mask
from .restorer import restore
from .recognizer import recognize

__all__ = ["desensitize", "restore", "recognize"]


def desensitize(text: str) -> tuple[str, dict[str, str]]:
    """对文本进行 PHI 脱敏。

    流程：识别 PHI 实体 -> 替换为占位符，同时维护 占位符 -> 原文 的映射表。

    Args:
        text: 原始文本。

    Returns:
        (脱敏后文本, 映射表)。映射表形如 {"[手机号]": "13800000000", ...}，
        用于后续 restore 还原。
    """
    entities = recognize(text)
    return _mask(text, entities)
