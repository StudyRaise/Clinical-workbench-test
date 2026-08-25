from __future__ import annotations

from contextlib import asynccontextmanager

from .services.clients import EmbeddingRouter, LLMRouter


@asynccontextmanager
def get_llm_router():
    router = LLMRouter()
    try:
        yield router
    finally:
        await router.close()


@asynccontextmanager
def get_embedding_router():
    router = EmbeddingRouter()
    try:
        yield router
    finally:
        await router.close()
