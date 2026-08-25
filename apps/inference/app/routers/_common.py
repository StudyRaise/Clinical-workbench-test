"""路由公共辅助函数。"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def parse_llm_json(text: str, default: Any | None = None) -> Any:
    """从 LLM 输出中稳健地解析 JSON。

    依次尝试：
    1. 直接 json.loads；
    2. 提取首个 {...} 或 [...] 片段再解析；
    3. 均失败返回 default。

    Args:
        text: LLM 输出文本。
        default: 解析失败时的兜底值。

    Returns:
        解析出的对象，或 default。
    """
    if not text:
        return default

    candidates = [text]
    for pattern in (r"\{.*\}", r"\[.*\]"):
        m = re.search(pattern, text, re.DOTALL)
        if m:
            candidates.append(m.group())

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue

    logger.warning("LLM 输出解析为 JSON 失败，返回默认值")
    return default
