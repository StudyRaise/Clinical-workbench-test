from __future__ import annotations

from pydantic import BaseModel, Field


class EmbeddingRequest(BaseModel):
    inputs: list[str]
    model: str = Field(default="text-embedding-3-small")
    tenant_id: str = Field(default="public")


class EmbeddingResponse(BaseModel):
    vectors: list[list[float]]
    model: str
    dimensions: int
