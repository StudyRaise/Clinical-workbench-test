"""混合检索（Hybrid Search）。

结合两类信号：
1. 向量检索：Milvus 余弦相似度（语义相关）。
2. 关键词检索：轻量 BM25（词面匹配）。

按权重加权合并（默认 0.7 / 0.3），输出统一的排序结果。
Milvus 不可用时自动退化为仅 BM25；两者皆不可用时返回空列表。
"""
from __future__ import annotations

import logging
import math
import re
from collections import Counter
from typing import Any, Optional

from ..config import settings
from ..utils.milvus_client import MilvusClient, milvus_client as _default_milvus
from .embedding import EmbeddingClient, embedding_client as _default_embedding

logger = logging.getLogger(__name__)

# 分词：ASCII 单词 / 数字，或连续汉字
_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+|[\u4e00-\u9fff]+")


def _tokenize(text: str) -> list[str]:
    """轻量中文分词：汉字生成二元组，ASCII 按单词切分。"""
    tokens: list[str] = []
    for m in _TOKEN_RE.finditer(text.lower()):
        tok = m.group()
        if tok.isascii():
            tokens.append(tok)
        else:
            chars = tok
            if len(chars) == 1:
                tokens.append(chars)
            else:
                tokens.extend(chars[i : i + 2] for i in range(len(chars) - 1))
    return tokens


class BM25Index:
    """极简内存 BM25 索引（骨架实现，可替换为 ES / OpenSearch）。"""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.documents: list[str] = []
        self.doc_lengths: list[int] = []
        self.avgdl = 0.0
        self.df: Counter[str] = Counter()          # term -> 文档频率
        self.postings: dict[str, dict[int, int]] = {}  # term -> {doc_idx: tf}

    def add_documents(self, documents: list[str]) -> None:
        """批量加入文档并构建倒排索引。"""
        for doc in documents:
            doc_idx = len(self.documents)
            self.documents.append(doc)
            tokens = _tokenize(doc)
            self.doc_lengths.append(len(tokens))
            for term in set(tokens):
                self.df[term] += 1
            tf = Counter(tokens)
            for term, count in tf.items():
                self.postings.setdefault(term, {})[doc_idx] = count
        self.avgdl = sum(self.doc_lengths) / len(self.doc_lengths) if self.doc_lengths else 0.0

    def _idf(self, term: str) -> float:
        """BM25 IDF，平滑处理避免负值。"""
        n = len(self.documents)
        df = self.df.get(term, 0)
        return math.log(1 + (n - df + 0.5) / (df + 0.5))

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """返回按 BM25 得分排序的结果：[{"text": ..., "score": ...}]。"""
        if not self.documents:
            return []
        query_terms = _tokenize(query)
        scores: dict[int, float] = {}
        for term in query_terms:
            idf = self._idf(term)
            if idf <= 0:
                continue
            for doc_idx, tf in self.postings.get(term, {}).items():
                dl = self.doc_lengths[doc_idx]
                denom = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
                scores[doc_idx] = scores.get(doc_idx, 0.0) + idf * (tf * (self.k1 + 1)) / denom
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:top_k]
        return [{"text": self.documents[idx], "score": score} for idx, score in ranked]


def _normalize(items: list[dict[str, Any]], key: str = "score") -> list[dict[str, Any]]:
    """将得分线性归一化到 [0, 1]。"""
    if not items:
        return items
    max_score = max(item.get(key, 0.0) for item in items)
    if max_score <= 0:
        return items
    for item in items:
        item[f"{key}_norm"] = item.get(key, 0.0) / max_score
    return items


def hybrid_search(
    query: str,
    corpus: list[str] | None = None,
    top_k: int | None = None,
    weights: tuple[float, float] | None = None,
    milvus: Optional[MilvusClient] = None,
    embedding: Optional[EmbeddingClient] = None,
) -> list[dict[str, Any]]:
    """混合检索：向量 + BM25 加权合并。

    Args:
        query: 查询文本。
        corpus: 关键词检索的候选语料（未提供时仅用向量检索）。
        top_k: 返回条数，默认取配置 TOP_K。
        weights: (向量权重, 关键词权重)，默认 (0.7, 0.3)。
        milvus: Milvus 客户端，默认模块实例。
        embedding: 向量化客户端，默认模块实例。

    Returns:
        合并排序结果：[{"text": ..., "score": 加权分, "source": "vector"|"bm25"|"hybrid", ...}]。
    """
    k = top_k or settings.top_k
    w_vec, w_bm = weights or settings.hybrid_weights
    mv = milvus or _default_milvus
    emb = embedding or _default_embedding

    # ---- 1. 向量检索 ----
    vector_results: list[dict[str, Any]] = []
    if mv.connected:
        try:
            query_vec = emb.embed_query(query)
            raw = mv.search(query_vec, top_k=k)
            vector_results = [
                {"text": hit["text"], "score": hit["score"], "source": "vector", "metadata": hit.get("metadata", {})}
                for hit in raw
            ]
        except Exception as exc:  # noqa: BLE001 - 降级
            logger.warning("向量检索失败（降级）: %s", exc)
    else:
        logger.info("Milvus 未连接，跳过向量检索")

    # ---- 2. BM25 关键词检索 ----
    bm25_results: list[dict[str, Any]] = []
    if corpus:
        try:
            index = BM25Index()
            index.add_documents(corpus)
            bm25_results = [
                {"text": hit["text"], "score": hit["score"], "source": "bm25"}
                for hit in index.search(query, top_k=k)
            ]
        except Exception as exc:  # noqa: BLE001 - 降级
            logger.warning("BM25 检索失败（降级）: %s", exc)

    if not vector_results and not bm25_results:
        return []

    _normalize(vector_results, "score")
    _normalize(bm25_results, "score")

    # ---- 3. 合并：同一文本取两边得分加权求和 ----
    merged: dict[str, dict[str, Any]] = {}
    for item in vector_results:
        merged[item["text"]] = item
    for item in bm25_results:
        if item["text"] in merged:
            merged[item["text"]]["score"] = w_vec * merged[item["text"]]["score_norm"] + w_bm * item["score_norm"]
            merged[item["text"]]["source"] = "hybrid"
        else:
            item["score"] = w_bm * item["score_norm"]
            item["source"] = "bm25"
            merged[item["text"]] = item

    combined = sorted(merged.values(), key=lambda item: item["score"], reverse=True)[:k]
    for item in combined:
        item.pop("score_norm", None)
    return combined
