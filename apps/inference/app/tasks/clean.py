"""批量数据清洗任务（占位骨架）。

接收一批文本，执行基础清洗（空白规整、PHI 脱敏），
后续可扩展：去重、术语标准化、质量评分等。
"""
from __future__ import annotations

import logging
import re
from typing import Any

from ..desensitize import desensitize
from .celery_app import celery_app

logger = logging.getLogger(__name__)


def _clean_text(text: str) -> dict[str, Any]:
    """单条文本清洗：规整空白 + PHI 脱敏。"""
    normalized = re.sub(r"\s+", " ", text).strip()
    masked, mapping = desensitize(normalized)
    return {
        "original": text,
        "cleaned": masked,
        "has_phi": bool(mapping),
        "phi_count": len(mapping),
    }


@celery_app.task(name="tasks.clean_batch")
def clean_batch(texts: list[str], options: dict[str, Any] | None = None) -> dict[str, Any]:
    """批量清洗任务（占位）。

    Args:
        texts: 待清洗的文本列表。
        options: 可选配置（保留字段，后续扩展，如启用术语标准化）。

    Returns:
        {"status": "ok", "total": n, "with_phi": k, "results": [...]}
    """
    opts = options or {}
    logger.info("clean_batch 开始：共 %d 条，options=%s", len(texts), opts)
    results = []
    for text in texts:
        try:
            results.append(_clean_text(text))
        except Exception as exc:  # noqa: BLE001 - 单条失败不阻断整批
            logger.warning("clean_batch 单条失败（跳过）: %s", exc)
            results.append({"original": text, "cleaned": None, "has_phi": False, "error": str(exc)})

    return {
        "status": "ok",
        "total": len(texts),
        "with_phi": sum(1 for r in results if r.get("has_phi")),
        "results": results,
    }
