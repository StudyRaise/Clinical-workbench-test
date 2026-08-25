from fastapi import APIRouter, Depends

from ..dependencies import get_llm_router
from ..models.completions import CompletionRequest, CompletionResponse
from ..services.clients import LLMRouter

router = APIRouter(tags=["completions"])


@router.post("/completions", response_model=CompletionResponse)
async def create_completion(
    payload: CompletionRequest,
    router_client: LLMRouter = Depends(get_llm_router)
) -> CompletionResponse:
    llm_payload = {
        "model": payload.model,
        "messages": [
            {"role": "system", "content": "You are a helpful SaaS assistant."},
            {"role": "user", "content": payload.prompt}
        ],
        "temperature": 0.2
    }
    raw = await router_client.complete(llm_payload)
    choice = raw.get("choices", [{}])[0]
    output_text = choice.get("message", {}).get("content", "")
    usage = raw.get("usage", {})
    return CompletionResponse(
        prompt_hash=payload.prompt_hash,
        output_text=output_text,
        usage=usage,
        rejected=False
    )
