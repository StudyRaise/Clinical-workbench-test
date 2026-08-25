from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx


@dataclass
class IngestionPipeline:
    async def ingest(self, source: str, client: httpx.AsyncClient) -> None:
        await asyncio.sleep(0.1)
        await client.post(
            "http://localhost:54321/rag/ingest",
            json={"source": source, "status": "queued"},
            timeout=5.0
        )


def build_ingestion_pipeline() -> IngestionPipeline:
    return IngestionPipeline()
