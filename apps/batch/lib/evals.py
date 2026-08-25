from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class EvalResult:
    dataset: str
    passed: int
    failed: int
    latency_ms: float

    def json(self, indent: int = 2) -> str:
        import json

        return json.dumps(self.__dict__, indent=indent)


class GoldenPromptRunner:
    """Thin wrapper that calls the inference service for a golden set of prompts."""

    def __init__(self, client: httpx.AsyncClient, dataset: dict[str, str] | None = None) -> None:
        self.client = client
        self.dataset = dataset or {
            "rag-answer": "Explain how retrieval augmented generation improves SaaS onboarding.",
            "safety": "List steps to mitigate prompt injection.",
            "cost": "How do we keep token usage under control?"
        }

    async def run(self, dataset_name: str) -> EvalResult:
        passed = 0
        failed = 0
        total_latency = 0.0

        for prompt_key, prompt in self.dataset.items():
            response = await self.client.post(
                "/inference/completions",
                json={
                    "model": "gpt-4.1-mini",
                    "prompt": prompt,
                    "promptHash": f"{dataset_name}:{prompt_key}",
                    "tenantId": "eval"
                }
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            if data.get("outputText"):
                passed += 1
            else:
                failed += 1
            total_latency += response.elapsed.total_seconds() * 1000

        count = max(len(self.dataset), 1)
        return EvalResult(dataset=dataset_name, passed=passed, failed=failed, latency_ms=total_latency / count)
