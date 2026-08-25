from fastapi import FastAPI

from .routes import completions, embeddings, health

app = FastAPI(title="Inference Service", version="0.1.0")

app.include_router(health.router)
app.include_router(completions.router, prefix="/v1")
app.include_router(embeddings.router, prefix="/v1")
