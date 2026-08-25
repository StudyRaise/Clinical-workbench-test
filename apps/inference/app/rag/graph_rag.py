"""Graph RAG：实体-关系图构建（骨架 / 占位实现）。

当前实现：
- 简单的医学实体抽取（基于规则：药物 / 诊断 / 检验指标 + 病历号关联）。
- 内存图存储：节点（实体）+ 边（共现关系）。
- 图查询：返回与目标实体相关的邻居实体及关系强度。

后续可替换为真实图谱（Neo4j / NebulaGraph / 知识图谱服务）。
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

# 常见医学实体占位词典（可扩展 / 接入 ICD-10、RxNorm 等词表）
_DRUG_KEYWORDS = ["阿司匹林", "二甲双胍", "氯吡格雷", "阿托伐他汀", "胰岛素", "华法林", "氨氯地平", "美托洛尔"]
_DIAGNOSIS_KEYWORDS = ["高血压", "糖尿病", "冠心病", "脑梗死", "心力衰竭", "肺炎", "贫血", "高脂血症"]
_TEST_KEYWORDS = ["肌酐", "尿素氮", "血糖", "糖化血红蛋白", "总胆固醇", "低密度脂蛋白", "白细胞", "血红蛋白"]

_ENTITY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("drug", re.compile("|".join(map(re.escape, _DRUG_KEYWORDS)))),
    ("diagnosis", re.compile("|".join(map(re.escape, _DIAGNOSIS_KEYWORDS)))),
    ("test", re.compile("|".join(map(re.escape, _TEST_KEYWORDS)))),
]


def extract_entities(text: str) -> list[dict[str, str]]:
    """从文本中抽取医学实体（规则占位）。

    Returns:
        [{"type": "drug"|"diagnosis"|"test", "name": "阿司匹林"}, ...]
    """
    if not text:
        return []
    entities: list[dict[str, str]] = []
    for type_, pattern in _ENTITY_PATTERNS:
        for m in pattern.finditer(text):
            entities.append({"type": type_, "name": m.group()})
    # 去重（保持首次出现顺序）
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, str]] = []
    for ent in entities:
        key = (ent["type"], ent["name"])
        if key not in seen:
            seen.add(key)
            unique.append(ent)
    return unique


class GraphRAG:
    """极简实体关系图：节点 + 共现边（骨架）。"""

    def __init__(self) -> None:
        self.nodes: dict[str, dict[str, str]] = {}          # name -> {type}
        self.edges: dict[str, dict[str, float]] = defaultdict(dict)  # name -> {neighbor: weight}

    def build_graph(self, documents: list[str]) -> int:
        """基于文档共现构建图。

        同一文档内出现的实体两两建边，权重累加。

        Returns:
            图中实体（节点）数量。
        """
        for doc in documents:
            ents = extract_entities(doc)
            names = [e["name"] for e in ents]
            for e in ents:
                self.nodes.setdefault(e["name"], {"type": e["type"]})
            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    a, b = names[i], names[j]
                    self.edges[a][b] = self.edges[a].get(b, 0.0) + 1.0
                    self.edges[b][a] = self.edges[b].get(a, 0.0) + 1.0
        logger.info("GraphRAG: 构建完成，共 %d 个实体", len(self.nodes))
        return len(self.nodes)

    def query(self, entity: str, top_k: int = 10) -> list[dict[str, Any]]:
        """查询与目标实体相关的邻居（按共现权重排序）。

        Returns:
            [{"entity": ..., "type": ..., "weight": ...}, ...]
        """
        if entity not in self.nodes:
            return []
        neighbors = self.edges.get(entity, {})
        ranked = sorted(neighbors.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        return [
            {"entity": name, "type": self.nodes.get(name, {}).get("type"), "weight": weight}
            for name, weight in ranked
        ]

    def summarize(self, text: str) -> dict[str, Any]:
        """对单段文本做快速图视角总结（实体 + 关联）。"""
        ents = extract_entities(text)
        names = list(dict.fromkeys(e["name"] for e in ents))
        relations = []
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if names[j] in self.edges.get(names[i], {}):
                    relations.append({"from": names[i], "to": names[j]})
        return {"entities": ents, "relations": relations}
