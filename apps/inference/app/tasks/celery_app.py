"""Celery 应用定义。

broker / backend 使用 Redis（REDIS_URL，默认 redis://127.0.0.1:6379/0）。
任务模块在下方显式导入，确保任务被注册。

启动 worker 示例：
    celery -A app.tasks.celery_app.celery_app worker --loglevel=info -P solo
"""
from __future__ import annotations

from celery import Celery

from ..config import settings

celery_app = Celery(
    "inference_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# 显式导入任务模块，保证注册
from . import clean, ingest  # noqa: E402,F401
