"""Schema-aware Retrieval：变量字典 + few-shot 样例检索。

用途：当查询涉及结构化字段（检验指标 / 临床变量）时，
先检索出「与查询相关的字段定义」与「匹配的 few-shot 样例」，
作为上下文注入 LLM，提升结构化输出的准确性。

实现为内存骨架：字段字典 + 轻量相似度匹配，可替换为数据库 / ES 检索。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from .retrieval import _tokenize

logger = logging.getLogger(__name__)


@dataclass
class SchemaField:
    """结构化字段定义。"""

    name: str                     # 字段名（如 blood_pressure）
    description: str              # 字段含义
    unit: str = ""                # 单位
    synonyms: list[str] = field(default_factory=list)  # 同义词 / 别名


# 默认的临床变量字典（示例，可按业务扩展）
_DEFAULT_FIELDS: list[SchemaField] = [
    SchemaField("blood_pressure", "血压（收缩压/舒张压）", "mmHg", ["血压", "收缩压", "舒张压"]),
    SchemaField("heart_rate", "心率", "次/分", ["心率", "脉搏"]),
    SchemaField("blood_glucose", "血糖", "mmol/L", ["血糖", "空腹血糖"]),
    SchemaField("temperature", "体温", "℃", ["体温", "发热"]),
    SchemaField("spo2", "血氧饱和度", "%", ["血氧", "氧饱和度", "SpO2"]),
    SchemaField("creatinine", "肌酐", "μmol/L", ["肌酐", "Cr"]),
]


class SchemaRegistry:
    """变量字典注册表。"""

    def __init__(self, fields: list[SchemaField] | None = None) -> None:
        # 未显式传入字段时，使用内置默认临床变量字典
        self.fields: dict[str, SchemaField] = {}
        for field in (fields if fields is not None else _DEFAULT_FIELDS):
            self.register(field)

    def register(self, field: SchemaField) -> None:
        self.fields[field.name] = field

    def _keywords(self, field: SchemaField) -> set[str]:
        """字段的检索关键词集合（名称 + 同义词分词）。"""
        kws = set(_tokenize(field.name))
        for syn in field.synonyms:
            kws.update(_tokenize(syn))
        return kws

    def retrieve(self, query: str, top_k: int = 5) -> list[SchemaField]:
        """按关键词重叠检索相关字段。

        Returns:
            按匹配度降序的字段列表。
        """
        query_tokens = set(_tokenize(query))
        if not query_tokens:
            return list(self.fields.values())[:top_k]
        scored = []
        for field in self.fields.values():
            overlap = len(query_tokens & self._keywords(field))
            if overlap > 0:
                scored.append((overlap, field))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [f for _, f in scored[:top_k]]


class SchemaAwareRetriever:
    """Schema-aware 检索器：字段 + few-shot 样例联合检索。"""

    def __init__(self, registry: SchemaRegistry | None = None, examples: list[dict[str, Any]] | None = None) -> None:
        self.registry = registry or SchemaRegistry(_DEFAULT_FIELDS)
        self.examples: list[dict[str, Any]] = examples or []

    def add_examples(self, examples: list[dict[str, Any]]) -> None:
        """登记 few-shot 样例。样例形如 {"input": "...", "output": {...}}。"""
        self.examples.extend(examples)

    def _example_score(self, example: dict[str, Any], query_tokens: set[str]) -> int:
        """样例与查询的关键词重叠度（基于 input 字段）。"""
        text = str(example.get("input", ""))
        return len(query_tokens & set(_tokenize(text)))

    def retrieve(self, query: str, top_k_fields: int = 5, top_k_examples: int = 3) -> dict[str, Any]:
        """联合检索相关字段与 few-shot 样例。

        Returns:
            {"fields": [SchemaField, ...], "examples": [dict, ...],
             "schema_text": 供 LLM 提示词使用的字段说明文本}
        """
        fields = self.registry.retrieve(query, top_k_fields)
        query_tokens = set(_tokenize(query))
        scored = [(self._example_score(ex, query_tokens), idx, ex) for idx, ex in enumerate(self.examples)]
        scored.sort(key=lambda item: item[0], reverse=True)
        examples = [ex for score, _, ex in scored if score > 0][:top_k_examples]

        schema_text = "\n".join(
            f"- {f.name}: {f.description}" + (f"（单位：{f.unit}）" if f.unit else "")
            for f in fields
        )
        return {"fields": fields, "examples": examples, "schema_text": schema_text}
