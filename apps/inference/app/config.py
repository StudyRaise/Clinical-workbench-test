"""全局配置模块。

所有配置均从环境变量读取，便于在不同部署环境（本地 / 测试 / 生产）间切换。
外部服务（数据库 / Milvus / MinIO / LLM）均提供默认值，连接失败时由各客户端
内部 try/except 降级处理，避免阻塞服务启动。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 兼容从任意工作目录启动：优先加载仓库根目录的 .env（不覆盖已存在的环境变量）
# config.py 位于 <repo>/apps/inference/app/config.py，parents[3] 即仓库根目录
load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)


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
    # 全局覆盖：任意 provider 都可用 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 统一指定
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", ""))
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", ""))
    qwen_api_key: str = field(default_factory=lambda: os.getenv("QWEN_API_KEY", ""))
    deepseek_api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    # SenseNova（商汤日日新，OpenAI 兼容）
    sensenova_api_key: str = field(default_factory=lambda: os.getenv("SENSENOVA_API_KEY", ""))
    sensenova_base_url: str = field(
        default_factory=lambda: os.getenv("SENSENOVA_BASE_URL", "https://token.sensenova.cn/v1")
    )
    sensenova_model: str = field(default_factory=lambda: os.getenv("SENSENOVA_MODEL", "glm-5.2"))
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

    # ---------- SenseCore RAG ----------
    sensecore_rag_url: str = field(
        default_factory=lambda: os.getenv(
            "SENSECORE_RAG_URL",
            "https://rag.cn-sh-01.sensecoreapi.cn/studio/rag/chat/v1/release:chat",
        )
    )
    sensecore_release_key: str = field(default_factory=lambda: os.getenv("SENSECORE_RELEASE_KEY", ""))
    # SenseCore 控制台 AccessKey / SecretKey（AI_Studio RAG_openapi 使用 HMAC 鉴权，
    # 见 https://www.sensecore.cn/help/docs/model-as-a-service/AI_Studio/API/RAG_openapi/authentication）
    sensecore_access_key: str = field(default_factory=lambda: os.getenv("SENSECORE_ACCESS_KEY", ""))
    sensecore_secret_key: str = field(default_factory=lambda: os.getenv("SENSECORE_SECRET_KEY", ""))
    # 可选的显式 Bearer Token（从浏览器 DevTools 复制的完整 Authorization 头值，优先级最高）。
    # 未配置时回退为：用 AccessKey/SecretKey 生成 HMAC 鉴权头。
    sensecore_bearer_token: str = field(default_factory=lambda: os.getenv("SENSECORE_BEARER_TOKEN", ""))

    # 业务模型（LLM）相关
    model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "glm-5.2"))
    preop_model: str = field(default_factory=lambda: os.getenv("PREOP_MODEL", ""))
    discharge_model: str = field(default_factory=lambda: os.getenv("DISCHARGE_MODEL", ""))
    research_model: str = field(default_factory=lambda: os.getenv("RESEARCH_MODEL", ""))


# 模块级单例，便于各处直接 import 使用
settings = Settings()
