from fastapi import FastAPI

from .config import settings
from .routes import completions, embeddings, health
from .routers import discharge, knowledge, preop, research

app = FastAPI(title=settings.app_name, version="0.1.0")

# 原有 /v1 路由（保留骨架）
app.include_router(health.router)
app.include_router(completions.router, prefix="/v1")
app.include_router(embeddings.router, prefix="/v1")

# 新增 RAG 业务路由（prefix /api）
app.include_router(preop.router)
app.include_router(discharge.router)
app.include_router(research.router)
app.include_router(knowledge.router)
