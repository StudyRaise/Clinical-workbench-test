"""文本分块工具。

实现 RecursiveCharacterTextSplitter 风格的递归字符分块：
按「段落 -> 句号 -> 分号 -> 逗号 -> 空格 -> 单字符」优先级递归切分，
尽可能在语义边界处断开，同时支持相邻块之间的重叠（overlap）以保证上下文连续。

参数由环境变量控制：CHUNK_SIZE（默认 500）、CHUNK_OVERLAP（默认 50）。
"""
from __future__ import annotations

from typing import Iterator

from ..config import settings

# 递归切分优先级：先尝试更大的语义边界
_SEPARATORS = ["\n\n", "\n", "。", "；", "，", " ", ""]


def split_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    """将长文本切分为多个 chunk。

    Args:
        text: 原始文本。
        chunk_size: 每个 chunk 的目标长度（字符数），默认取配置。
        chunk_overlap: 相邻 chunk 重叠长度（字符数），默认取配置。

    Returns:
        文本块列表。空文本返回空列表。
    """
    size = chunk_size or settings.chunk_size
    overlap = chunk_overlap or settings.chunk_overlap
    if not text:
        return []
    if len(text) <= size:
        return [text]

    return list(_recursive_split(text, size, overlap))


def _recursive_split(text: str, chunk_size: int, chunk_overlap: int) -> Iterator[str]:
    """递归切分核心：用当前分隔符尝试切分，不足则降级到下一级分隔符。"""
    if len(text) <= chunk_size:
        yield text.strip()
        return

    for sep in _SEPARATORS:
        if sep == "":
            # 兜底：按固定长度硬切
            for start in range(0, len(text), chunk_size - chunk_overlap):
                yield text[start : start + chunk_size].strip()
            return

        if sep not in text:
            continue

        parts = text.split(sep)
        current = ""
        for part in parts:
            piece = (part + sep) if sep != " " else part
            if not current:
                candidate = piece
            else:
                candidate = current + piece
            if len(candidate) > chunk_size:
                if current:
                    yield current.strip()
                # 剩余部分继续递归（保留 overlap 尾部）
                remainder = text[len(current) - chunk_overlap :] if current else text
                yield from _recursive_split(remainder, chunk_size, chunk_overlap)
                return
            current = candidate
        if current:
            yield current.strip()
        return


def chunk_documents(documents: list[str], chunk_size: int | None = None, chunk_overlap: int | None = None) -> list[dict]:
    """批量分块，附带来源索引元数据（供入库使用）。

    Returns:
        [{"text": "...", "metadata": {"source_index": i, "chunk_index": j}}, ...]
    """
    results: list[dict] = []
    for i, doc in enumerate(documents):
        chunks = split_text(doc, chunk_size, chunk_overlap)
        for j, chunk in enumerate(chunks):
            results.append({"text": chunk, "metadata": {"source_index": i, "chunk_index": j}})
    return results
