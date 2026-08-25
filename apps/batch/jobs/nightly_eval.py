from __future__ import annotations

import asyncio
from datetime import datetime

import httpx
import typer

from apps.batch.lib import GoldenPromptRunner

app = typer.Typer(help="Nightly evaluation entrypoint")


@app.command()
def run(dataset: str = "golden-regression") -> None:
    """Execute the golden prompt regression suite."""

    async def _run() -> None:
        async with httpx.AsyncClient(base_url="http://localhost:8001") as client:
            runner = GoldenPromptRunner(client)
            report = await runner.run(dataset)
            typer.echo(f"Evaluation completed at {datetime.utcnow().isoformat()}Z")
            typer.echo(report.json(indent=2))

    asyncio.run(_run())


if __name__ == "__main__":
    app()
