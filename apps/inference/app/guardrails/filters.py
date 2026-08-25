"""输入合规过滤器。

提供两类检查：
1. 越狱提示（jailbreak）关键词拦截：如「忽略以上指令」「DAN mode」等，
   用于阻断 prompt injection。
2. 敏感词过滤：命中敏感词时返回拒绝。

对外核心函数：check(text) -> (allowed: bool, reason: str | None)。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# 越狱提示关键词（英文为主，小写匹配）
_JAILBREAK_KEYWORDS: list[str] = [
    "ignore previous instructions",
    "ignore all instructions",
    "ignore the above",
    "forget your instructions",
    "dan mode",
    "do anything now",
    "jailbreak",
    "system prompt",
    "reveal your system prompt",
    "you are now",
    "no restrictions",
    "act as if you have no rules",
    "bypass",
]

# 中文越狱 / 提示注入关键词
_JAILBREAK_KEYWORDS_ZH: list[str] = [
    "忽略以上",
    "忽略之前",
    "无视指令",
    "不要理会",
    "解除限制",
    "你现在是",
    "扮演",
    "越狱",
]

# 敏感词（占位示例，实际可按业务扩展 / 接入词库）
_SENSITIVE_KEYWORDS: list[str] = [
    "色情",
    "赌博",
    "毒品",
    "枪支",
    "自杀教程",
    "恐怖袭击",
    "洗钱",
]


@dataclass(frozen=True)
class FilterResult:
    """过滤结果。

    Attributes:
        allowed: 是否允许继续处理。
        reason: 拦截原因；allowed 为 True 时为 None。
        matched: 命中的关键词（用于日志审计）。
    """

    allowed: bool
    reason: str | None = None
    matched: str | None = None


def _contains_any(text_lower: str, keywords: list[str]) -> str | None:
    """返回第一个命中的关键词，未命中返回 None。"""
    for kw in keywords:
        if kw.lower() in text_lower:
            return kw
    return None


def check(text: str) -> FilterResult:
    """检查文本是否允许进入下游流程。

    Args:
        text: 用户输入文本。

    Returns:
        FilterResult：allowed=False 时 reason 说明拦截原因。
    """
    if not text:
        return FilterResult(allowed=True)

    text_lower = text.lower()

    # 1. 越狱提示拦截
    matched_jb = _contains_any(text_lower, _JAILBREAK_KEYWORDS) or _contains_any(text_lower, _JAILBREAK_KEYWORDS_ZH)
    if matched_jb:
        return FilterResult(allowed=False, reason="检测到越狱提示 / 提示注入", matched=matched_jb)

    # 2. 敏感词过滤
    matched_sens = _contains_any(text_lower, _SENSITIVE_KEYWORDS)
    if matched_sens:
        return FilterResult(allowed=False, reason="检测到敏感内容", matched=matched_sens)

    return FilterResult(allowed=True)


# 兼容别名：直接返回 (allowed, reason)
def filter_text(text: str) -> tuple[bool, str | None]:
    """兼容旧式签名：返回 (allowed, reason)。"""
    result = check(text)
    return result.allowed, result.reason
