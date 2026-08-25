from fastapi import APIRouter, Depends

from ..dependencies import get_embedding_router
from ..models.embeddings import EmbeddingRequest, EmbeddingResponse
from ..services.clients import EmbeddingRouter

router = APIRouter(tags=["embeddings"])


@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embedding(
    payload: EmbeddingRequest,
    router_client: EmbeddingRouter = Depends(get_embedding_router)
) -> EmbeddingResponse:
    response = await router_client.embed({"model": payload.model, "input": payload.inputs})
    data = response.get("data", [])
    vectors = [item.get("embedding", []) for item in data]
    dimensions = len(vectors[0]) if vectors else 0
    return EmbeddingResponse(vectors=vectors, model=payload.model, dimensions=dimensions)
