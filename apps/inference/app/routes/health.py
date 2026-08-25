from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Service health check")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "inference"}
