from __future__ import annotations

import asyncio
from datetime import datetime

import httpx
import typer

from apps.batch.lib import build_ingestion_pipeline

app = typer.Typer(help="Document indexing pipeline")


@app.command()
def run(source: str = "s3://ai-saas-docs") -> None:
    pipeline = build_ingestion_pipeline()

    async def _run() -> None:
        async with httpx.AsyncClient() as client:
            await pipeline.ingest(source, client)
            typer.echo(f"Index build completed at {datetime.utcnow().isoformat()}Z for {source}")

    asyncio.run(_run())


if __name__ == "__main__":
    app()
