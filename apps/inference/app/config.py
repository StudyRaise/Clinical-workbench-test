"""全局配置模块。

所有配置均从环境变量读取，便于在不同部署环境（本地 / 测试 / 生产）间切换。
外部服务（数据库 / Milvus / MinIO / LLM）均提供默认值，连接失败时由各客户端
内部 try/except 降级处理，避免阻塞服务启动。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _get_bool(name: str, default: bool = False) -> bool:
    """读取布尔型环境变量。"""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    """读取整型环境变量，非法值时回退默认值。"""
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass
class Settings:
    """应用配置集合。"""

    # ---------- 基础 ----------
    app_name: str = "Inference Service (RAG)"
    debug: bool = field(default_factory=lambda: _get_bool("DEBUG", False))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    # ---------- MySQL 数据库 ----------
    db_host: str = field(default_factory=lambda: os.getenv("DB_HOST", "127.0.0.1"))
    db_port: int = field(default_factory=lambda: _get_int("DB_PORT", 3306))
    db_user: str = field(default_factory=lambda: os.getenv("DB_USER", "root"))
    db_password: str = field(default_factory=lambda: os.getenv("DB_PASSWORD", ""))
    db_name: str = field(default_factory=lambda: os.getenv("DB_NAME", "inference"))

    @property
    def db_url(self) -> str:
        """拼装 SQLAlchemy 连接串（pymysql 驱动）。"""
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    # ---------- Milvus 向量库 ----------
    milvus_host: str = field(default_factory=lambda: os.getenv("MILVUS_HOST", "127.0.0.1"))
    milvus_port: int = field(default_factory=lambda: _get_int("MILVUS_PORT", 19530))
    milvus_collection: str = field(default_factory=lambda: os.getenv("MILVUS_COLLECTION", "doc_chunks"))

    # ---------- MinIO 对象存储 ----------
    minio_endpoint: str = field(default_factory=lambda: os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000"))
    minio_access_key: str = field(default_factory=lambda: os.getenv("MINIO_ACCESS_KEY", "minioadmin"))
    minio_secret_key: str = field(default_factory=lambda: os.getenv("MINIO_SECRET_KEY", "minioadmin"))
    minio_bucket: str = field(default_factory=lambda: os.getenv("MINIO_BUCKET", "rag-docs"))
    minio_secure: bool = field(default_factory=lambda: _get_bool("MINIO_SECURE", False))

    # ---------- Redis / Celery ----------
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"))

    # ---------- LLM（国产模型） ----------
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "qwen").strip().lower())
    qwen_api_key: str = field(default_factory=lambda: os.getenv("QWEN_API_KEY", ""))
    deepseek_api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    embedding_api_key: str = field(default_factory=lambda: os.getenv("EMBEDDING_API_KEY", ""))
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "text-embedding-v2"))
    embedding_dim: int = field(default_factory=lambda: _get_int("EMBEDDING_DIM", 1024))

    # ---------- RAG 参数 ----------
    chunk_size: int = field(default_factory=lambda: _get_int("CHUNK_SIZE", 500))
    chunk_overlap: int = field(default_factory=lambda: _get_int("CHUNK_OVERLAP", 50))
    top_k: int = field(default_factory=lambda: _get_int("TOP_K", 5))
    hybrid_weights: tuple[float, float] = (0.7, 0.3)  # 向量检索 / 关键词检索权重

    # ---------- 通用 LLM 超时 / 重试 ----------
    llm_timeout: float = field(default_factory=lambda: float(os.getenv("LLM_TIMEOUT", "60.0")))
    llm_max_retries: int = field(default_factory=lambda: _get_int("LLM_MAX_RETRIES", 3))


# 模块级单例，便于各处直接 import 使用
settings = Settings()
