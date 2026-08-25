"""Timeline 感知检索。

在混合检索结果基础上，按时间字段（metadata 中的 timestamp / date / 就诊时间 等）
排序输出，用于需要「时间线 / 病程回溯」的场景（如病历时间轴、随访记录）。

支持：
- 自动识别常见时间字段；
- 升序 / 降序（默认降序，最新在前）；
- 可按时间范围过滤。
"""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Optional

from .retrieval import hybrid_search

logger = logging.getLogger(__name__)

# 常见时间字段候选（按优先级）
_TIME_FIELDS = ("timestamp", "date", "time", "record_time", "就诊时间", "时间", "日期")


def _parse_time(value: Any) -> Optional[dt.datetime]:
    """尝试把时间值解析为 datetime；失败返回 None。"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # 秒级时间戳
        try:
            return dt.datetime.fromtimestamp(float(value))
        except (ValueError, OSError):
            return None
    if isinstance(value, dt.datetime):
        return value
    if isinstance(value, dt.date):
        return dt.datetime.combine(value, dt.time.min)
    text = str(value).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return dt.datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _extract_time(item: dict[str, Any]) -> Optional[dt.datetime]:
    """从检索结果中提取时间值。"""
    metadata = item.get("metadata") or {}
    for field in _TIME_FIELDS:
        if field in metadata:
            parsed = _parse_time(metadata[field])
            if parsed is not None:
                return parsed
    return None


def timeline_search(
    query: str,
    corpus: list[str] | None = None,
    top_k: int | None = None,
    order: str = "desc",
    start_time: str | None = None,
    end_time: str | None = None,
    milvus=None,
    embedding=None,
) -> list[dict[str, Any]]:
    """Timeline 感知检索。

    Args:
        query: 查询文本。
        corpus: 候选语料（可选）。
        top_k: 返回条数。
        order: 排序方向，"desc"（最新在前）或 "asc"（最早在前）。
        start_time / end_time: 可选的时间范围过滤（任意常见格式字符串）。
        milvus / embedding: 可选客户端注入。

    Returns:
        按时间排序的检索结果；无时间字段的记录排在末尾。
    """
    candidates = hybrid_search(query, corpus=corpus, top_k=top_k, milvus=milvus, embedding=embedding)

    # 时间范围过滤
    start = _parse_time(start_time) if start_time else None
    end = _parse_time(end_time) if end_time else None
    if start or end:
        filtered: list[dict[str, Any]] = []
        for item in candidates:
            t = _extract_time(item)
            if t is None:
                continue  # 无时间字段的记录在范围过滤下被剔除
            if start and t < start:
                continue
            if end and t > end:
                continue
            filtered.append(item)
        candidates = filtered

    def _sort_key(item: dict[str, Any]) -> tuple[int, Any]:
        t = _extract_time(item)
        if t is None:
            return (1, None)  # 无时间的排末尾
        return (0, t)

    reverse = order == "desc"
    candidates.sort(key=_sort_key, reverse=reverse)
    return candidates
