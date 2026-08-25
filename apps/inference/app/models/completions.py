from __future__ import annotations

from pydantic import BaseModel, Field


class CompletionRequest(BaseModel):
    prompt: str
    model: str = Field(default="gpt-4.1-mini", description="LLM identifier")
    tenant_id: str = Field(default="public")
    prompt_hash: str
    metadata: dict[str, str | int | float] | None = None


class CompletionResponse(BaseModel):
    prompt_hash: str
    output_text: str
    usage: dict[str, int | float] | None = None
    rejected: bool = False
    reason: str | None = None
