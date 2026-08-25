"""脱敏掩码器：将识别出的 PHI 实体替换为占位符，并维护映射表。

占位符规则：
- 首条使用基础占位符，如 [身份证]、[手机号]；
- 同一类型出现多个不同值时，追加序号，如 [手机号2]、[手机号3]；
- 相同值的重复出现复用同一个占位符，便于还原。

映射表形如 {"[手机号]": "13800000000", "[手机号2]": "13900000000", ...}。
"""
from __future__ import annotations

from .recognizer import PHIEntity

# 类型 -> 基础占位符
_TYPE_PLACEHOLDER = {
    "id_card": "[身份证]",
    "phone": "[手机号]",
    "name": "[姓名]",
    "address": "[地址]",
    "medical_no": "[病历号]",
}


def _placeholder_for(type_: str, seen: dict[str, str], mapping: dict[str, str], value: str) -> str:
    """生成（或复用）某个具体值的占位符。"""
    base = _TYPE_PLACEHOLDER.get(type_, f"[{type_}]")
    # 已存在该值的映射，直接复用
    for ph, original in mapping.items():
        if original == value and ph.startswith(base.rstrip("]")):
            return ph
    index = seen.get(type_, 0) + 1
    seen[type_] = index
    ph = base if index == 1 else f"{base[:-1]}{index}]"
    mapping[ph] = value
    return ph


def mask(text: str, entities: list[PHIEntity]) -> tuple[str, dict[str, str]]:
    """将 PHI 实体替换为占位符。

    Args:
        text: 原始文本。
        entities: recognizer.recognize 的输出。

    Returns:
        (脱敏后文本, 占位符->原文 映射表)。
    """
    if not text or not entities:
        return text, {}

    mapping: dict[str, str] = {}
    seen: dict[str, int] = {}  # type -> 已用序号

    # 按位置倒序替换，避免修改下标
    pieces: list[str] = []
    cursor = 0
    for ent in sorted(entities, key=lambda e: e.start):
        if ent.start < cursor:
            continue  # 跳过已被覆盖的区间
        ph = _placeholder_for(ent.type, seen, mapping, ent.value)
        pieces.append(text[cursor : ent.start])
        pieces.append(ph)
        cursor = ent.end
    pieces.append(text[cursor:])

    return "".join(pieces), mapping
