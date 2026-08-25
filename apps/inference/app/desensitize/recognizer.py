"""PHI（个人健康信息）识别器。

通过正则与启发式规则识别常见隐私字段：
- 身份证（18 位，末位可为 X）
- 手机号（1[3-9] 开头 11 位）
- 姓名（常见姓氏 + 1~2 字，启发式占位）
- 地址（省市 / 路街道 / 门牌号组合）
- 病历号 / 住院号 / 门诊号

识别结果以 span（起止位置）返回，便于 masker 精准替换。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# 常见姓氏（百家姓高频子集），用于姓名启发式识别
_COMMON_SURNAMES = "".join(
    "张王李赵刘陈杨黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文"
)

# 身份证：18 位（17 位数字 + 1 位数字或 X）
_ID_CARD_RE = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")

# 手机号：1[3-9] 开头的 11 位数字
_PHONE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")

# 姓名：常见姓氏 + 1~2 个汉字（首字母大写启发式，保守匹配避免过度误伤）
_NAME_RE = re.compile(rf"[{_COMMON_SURNAMES}][\u4e00-\u9fa5]{{1,2}}")

# 地址：省市县区 + 路街道 + 门牌号 组合
_ADDRESS_RE = re.compile(
    r"[\u4e00-\u9fa5]{2,10}(省|市|自治区)([\u4e00-\u9fa5]{2,15}(市|区|县))?"
    r"([\u4e00-\u9fa5]{2,10}(路|街|道|巷))?[\dA-Za-z]{0,10}号?"
)

# 病历号 / 住院号 / 门诊号：标识前缀 + 数字字母串
_MEDICAL_NO_RE = re.compile(r"(病历号|住院号|门诊号|就诊号|病案号)[:：\s]*([0-9A-Za-z-]{3,})")


@dataclass(frozen=True)
class PHIEntity:
    """一条被识别的 PHI 实体。

    Attributes:
        type: 类型，取值 id_card / phone / name / address / medical_no。
        value: 原始文本片段。
        start: 在原文中的起始下标（含）。
        end: 在原文中的结束下标（不含）。
    """

    type: str
    value: str
    start: int
    end: int


def _merge_overlaps(entities: list[PHIEntity]) -> list[PHIEntity]:
    """合并重叠 / 包含关系的实体，保留范围更大的那条。"""
    entities = sorted(entities, key=lambda e: (e.start, -(e.end - e.start)))
    merged: list[PHIEntity] = []
    for ent in entities:
        if merged and ent.start < merged[-1].end:
            # 与上一条重叠，取覆盖范围更大的
            if (ent.end - ent.start) > (merged[-1].end - merged[-1].start):
                merged[-1] = ent
            continue
        merged.append(ent)
    return merged


def _match(pattern: re.Pattern[str], text: str, type_: str) -> list[PHIEntity]:
    """对单个正则执行匹配并转为实体列表。"""
    return [
        PHIEntity(type=type_, value=m.group(), start=m.start(), end=m.end())
        for m in pattern.finditer(text)
    ]


def _match_medical_no(text: str) -> list[PHIEntity]:
    """病历号匹配：仅保留数字字母部分作为脱敏对象。"""
    entities: list[PHIEntity] = []
    for m in _MEDICAL_NO_RE.finditer(text):
        start = m.start(2)
        end = m.end(2)
        entities.append(PHIEntity(type="medical_no", value=text[start:end], start=start, end=end))
    return entities


def recognize(text: str) -> list[PHIEntity]:
    """识别文本中的所有 PHI 实体。

    Args:
        text: 原始文本。

    Returns:
        按位置排序、已合并重叠的实体列表；无命中返回空列表。
    """
    if not text:
        return []

    entities: list[PHIEntity] = []
    entities.extend(_match(_ID_CARD_RE, text, "id_card"))
    entities.extend(_match(_PHONE_RE, text, "phone"))
    entities.extend(_match(_NAME_RE, text, "name"))
    entities.extend(_match(_ADDRESS_RE, text, "address"))
    entities.extend(_match_medical_no(text))

    return _merge_overlaps(entities)
