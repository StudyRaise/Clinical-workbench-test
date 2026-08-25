"""MinIO 对象存储客户端封装。

提供连接、创建 bucket、上传 / 下载能力。
连接失败时降级为不可用标记，不阻塞服务启动。
"""
from __future__ import annotations

import io
import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

try:
    from minio import Minio
    from minio.error import S3Error  # noqa: F401 - 供调用方判断对象是否存在
    _MINIO_AVAILABLE = True
except ImportError:  # pragma: no cover - 依赖缺失时降级
    _MINIO_AVAILABLE = False
    logger.warning("minio 未安装，MinIO 客户端将以降级模式运行")
    Minio = None  # type: ignore
    S3Error = None  # type: ignore


class MinioClient:
    """MinIO 轻量封装，全部异常就地捕获。"""

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        secure: bool | None = None,
    ) -> None:
        self.endpoint = endpoint or settings.minio_endpoint
        self.access_key = access_key or settings.minio_access_key
        self.secret_key = secret_key or settings.minio_secret_key
        self.bucket = bucket or settings.minio_bucket
        self.secure = secure if secure is not None else settings.minio_secure
        self.client: Optional[object] = None
        self.connected = False
        self._connect()

    def _connect(self) -> None:
        """尝试连接；失败仅告警，不抛出。"""
        if not _MINIO_AVAILABLE:
            return
        try:
            self.client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
            # 通过一次轻量调用校验连通性
            self.client.bucket_exists(self.bucket)
            self.connected = True
            logger.info("MinIO 连接成功: %s (bucket=%s)", self.endpoint, self.bucket)
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            self.connected = False
            logger.warning("MinIO 连接失败（降级模式）: %s", exc)

    def ensure_bucket(self, bucket: str | None = None) -> bool:
        """确保 bucket 存在，不存在则创建。

        Returns:
            是否可用（已存在 / 创建成功均返回 True）。
        """
        if not _MINIO_AVAILABLE or not self.connected or self.client is None:
            return False
        name = bucket or self.bucket
        try:
            if not self.client.bucket_exists(name):
                self.client.make_bucket(name)
                logger.info("MinIO bucket 创建成功: %s", name)
            return True
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("MinIO ensure_bucket 失败（降级模式）: %s", exc)
            return False

    def upload_file(self, object_name: str, data: bytes, content_type: str = "application/octet-stream", bucket: str | None = None) -> bool:
        """上传字节内容到 MinIO。

        Args:
            object_name: 对象名（可含路径前缀，如 docs/xxx.pdf）。
            data: 文件二进制内容。
            content_type: MIME 类型。
            bucket: bucket 名，默认使用配置值。

        Returns:
            是否上传成功。
        """
        if not _MINIO_AVAILABLE or not self.connected or self.client is None:
            return False
        if not self.ensure_bucket(bucket):
            return False
        name = bucket or self.bucket
        try:
            self.client.put_object(
                name,
                object_name,
                io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
            return True
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("MinIO 上传失败（降级模式）: %s", exc)
            return False

    def download(self, object_name: str, bucket: str | None = None) -> bytes | None:
        """下载对象内容。

        Returns:
            文件二进制内容；对象不存在或连接异常返回 None。
        """
        if not _MINIO_AVAILABLE or not self.connected or self.client is None:
            return None
        name = bucket or self.bucket
        try:
            response = self.client.get_object(name, object_name)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("MinIO 下载失败（降级模式）: %s", exc)
            return None

    def exists(self, object_name: str, bucket: str | None = None) -> bool:
        """判断对象是否存在。"""
        if not _MINIO_AVAILABLE or not self.connected or self.client is None:
            return False
        name = bucket or self.bucket
        try:
            self.client.stat_object(name, object_name)
            return True
        except Exception:  # noqa: BLE001 - 对象不存在视为 False
            return False


# 模块级默认实例，可直接复用
minio_client = MinioClient()
