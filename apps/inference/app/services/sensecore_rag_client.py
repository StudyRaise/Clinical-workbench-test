"""SenseCore 知识库 RAG 客户端（AI_Studio RAG_openapi）。

覆盖：
- 知识库（数据集）管理：列表 / 创建 / 删除
  https://www.sensecore.cn/help/docs/model-as-a-service/AI_Studio/API/RAG_openapi/dataset/create-dataset
- 发布后会话接口 chat-release（非流式 + SSE 流式）
  https://www.sensecore.cn/help/docs/model-as-a-service/AI_Studio/API/RAG_openapi/conversation/chat-release

鉴权（官方 HMAC，见 authentication 文档）：
- release_key 只是请求体里标识已发布应用的字段，**不能用于鉴权**。
- 鉴权优先级：
  1) SENSECORE_BEARER_TOKEN：从浏览器 DevTools 复制的完整 Authorization 头值；
  2) SENSECORE_ACCESS_KEY + SENSECORE_SECRET_KEY：按官方文档动态生成 X-Date + Authorization。
- 未配置任何鉴权信息时，调用返回 None / 抛出 SenseCoreConfigError，由调用方降级处理。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class SenseCoreConfigError(Exception):
    """未配置 release_key / 鉴权信息时抛出。"""


def _hmac_auth_headers(access_key: str, secret_key: str) -> dict[str, str]:
    """按官方文档生成 X-Date 与 Authorization（HMAC-SHA256）。"""
    x_date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    sign_content = f"x-date: {x_date}"
    signature = base64.b64encode(
        hmac.new(secret_key.encode("utf-8"), sign_content.encode("utf-8"), hashlib.sha256).digest()
    ).decode("ascii")
    auth = (
        f'hmac accesskey="{access_key}", algorithm="hmac-sha256", '
        f'headers="x-date", signature="{signature}"'
    )
    return {"X-Date": x_date, "Authorization": auth}


class SenseCoreRagClient:
    """封装对 SenseCore AI_Studio RAG_openapi 的调用。"""

    _BASE = "https://rag.cn-sh-01.sensecoreapi.cn/studio/rag/chat/v1"

    def __init__(self) -> None:
        self.release_key = settings.sensecore_release_key
        self.bearer_token = settings.sensecore_bearer_token
        self.access_key = settings.sensecore_access_key
        self.secret_key = settings.sensecore_secret_key
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=120.0))
        return self._client

    # ---------- 鉴权 ----------

    def _auth_headers(self) -> dict[str, str]:
        if self.bearer_token:
            if self.bearer_token.lower().startswith(("bearer ", "hmac ")):
                return {"Authorization": self.bearer_token}
            return {"Authorization": f"Bearer {self.bearer_token}"}
        if self.access_key and self.secret_key:
            return _hmac_auth_headers(self.access_key, self.secret_key)
        raise SenseCoreConfigError("未配置鉴权（需 SENSECORE_BEARER_TOKEN 或 SENSECORE_ACCESS_KEY/SECRET_KEY）")

    def _headers(self) -> dict[str, str]:
        return {
            **self._auth_headers(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _check_configured(self) -> None:
        if not self.release_key:
            raise SenseCoreConfigError("未配置 SENSECORE_RELEASE_KEY")

    # ---------- 数据集（知识库）管理 ----------

    async def list_datasets(self, page_size: int = 50, filter_type: int = 1) -> list[dict[str, Any]]:
        """列出知识库。

        注意：dataset_filter_type=3（ACCESSIBLE_BY_ME）在该平台实测返回空，
        使用 1（CREATED_BY_ME 我创建的知识库）才能取到列表。
        """
        self._auth_headers()  # 触发鉴权配置检查
        payload = {"dataset_filter_type": filter_type, "page_size": page_size, "order_by": "create_time desc"}
        data = await self._post("/datasets:search", payload)
        return (data or {}).get("datasets", []) or []

    async def create_dataset(self, display_name: str, desc: str = "") -> dict[str, Any] | None:
        """创建知识库。"""
        self._auth_headers()
        return await self._post("/datasets", {"display_name": display_name, "desc": desc})

    async def delete_dataset(self, dataset_id: str) -> bool:
        """删除知识库，返回是否成功。"""
        self._auth_headers()
        try:
            resp = await self._get_client().delete(
                f"{self._BASE}/datasets/{dataset_id}", headers=self._headers()
            )
            if resp.status_code == 200:
                return True
            logger.warning("SenseCore 删除知识库失败: HTTP %s %s", resp.status_code, resp.text[:200])
            return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("SenseCore 删除知识库异常（降级模式）: %s", exc)
            return False

    # ---------- 知识（文档）管理 ----------

    async def list_documents(self, dataset_id: str, page_size: int = 200) -> list[dict[str, Any]]:
        """列出指定知识库下的文档。"""
        self._auth_headers()
        payload = {"page_size": page_size, "order_by": "create_time desc"}
        data = await self._post(f"/datasets/{dataset_id}/documents:search", payload)
        return (data or {}).get("documents", []) or []

    async def delete_document(self, dataset_id: str, document_id: str) -> bool:
        """删除知识库中的文档，返回是否成功。"""
        self._auth_headers()
        try:
            resp = await self._get_client().delete(
                f"{self._BASE}/datasets/{dataset_id}/documents/{document_id}",
                headers=self._headers(),
            )
            if resp.status_code == 200:
                return True
            logger.warning("SenseCore 删除文档失败: HTTP %s %s", resp.status_code, resp.text[:200])
            return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("SenseCore 删除文档异常（降级模式）: %s", exc)
            return False

    # ---------- 知识导入（文档上传，三步串联） ----------

    async def import_file(self, dataset_id: str, filename: str, data: bytes) -> dict[str, Any]:
        """将本地文件导入指定线上知识库。

        流程（官方 import-document 文档）：
        1) 创建知识导入任务（data_source_type=1 LOCAL_FILE）
        2) 批量预签名上传 URL，客户端直传文件（PUT 到 AOSS）
        3) 启动知识导入任务（:start）

        Raises:
            SenseCoreConfigError: 未配置鉴权。
            RuntimeError: 任一步骤失败。
        """
        self._auth_headers()
        client = self._get_client()

        # 1) 创建知识导入任务
        job = await self._post(
            f"/datasets/{dataset_id}/jobs",
            {"dataset_id": dataset_id, "data_source_type": 1},
        )
        job_id = (job or {}).get("job_id", "")
        if not job_id:
            raise RuntimeError("创建知识导入任务失败（未返回 job_id）")

        # 2) 预签名 URL + 直传
        presign = await self._post(
            f"/jobs/{job_id}/files:batchPresign",
            {"job_id": job_id, "rel_path": [filename]},
        )
        upload_url = ((presign or {}).get("result") or {}).get(filename, "")
        if not upload_url:
            raise RuntimeError("获取上传预签名 URL 失败")
        put_resp = await client.put(
            upload_url,
            content=data,
            headers={"Content-Type": "application/octet-stream"},
        )
        if put_resp.status_code not in (200, 201):
            raise RuntimeError(f"文件直传失败: HTTP {put_resp.status_code}")

        # 3) 启动知识导入任务（正常返回 200 且无响应体）
        start_resp = await client.post(
            f"{self._BASE}/datasets/{dataset_id}/jobs/{job_id}:start",
            headers=self._headers(),
            json={
                "dataset_id": dataset_id,
                "job_id": job_id,
                "failed_file_count": 0,
                "failed_file_size": 0,
                "documents": [],
            },
        )
        if start_resp.status_code != 200:
            raise RuntimeError(f"启动知识导入任务失败: HTTP {start_resp.status_code} {start_resp.text[:200]}")

        return {"job_id": job_id, "filename": filename, "dataset_id": dataset_id}

    # ---------- 会话（chat-release） ----------

    async def chat(
        self,
        content: str,
        conversation_id: str = "",
        action: int = 0,
    ) -> dict | None:
        """非流式知识库问答，返回完整 JSON（含 message / knowledge_base_results 等）。"""
        self._check_configured()
        payload = {
            "action": action,
            "content": content,
            "conversation_id": conversation_id,
            "release_key": self.release_key,
            "stream": False,
        }
        try:
            resp = await self._get_client().post(
                f"{self._BASE}/release:chat", headers=self._headers(), json=payload
            )
            if resp.status_code != 200:
                logger.warning("SenseCore RAG 调用失败: HTTP %s %s", resp.status_code, resp.text[:300])
                return None
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("SenseCore RAG 调用异常（降级模式）: %s", exc)
            return None

    async def chat_stream(
        self,
        content: str,
        conversation_id: str = "",
        action: int = 0,
    ) -> AsyncIterator[str]:
        """流式知识库问答：逐行产出 SSE 原文（含 'data: {...}' 行与 keep-alive 注释行）。

        Raises:
            SenseCoreConfigError: 未配置 release_key / 鉴权。
            httpx.HTTPStatusError: 上游非 200。
        """
        self._check_configured()
        payload = {
            "action": action,
            "content": content,
            "conversation_id": conversation_id,
            "release_key": self.release_key,
            "stream": True,
        }
        request = self._get_client().build_request(
            "POST", f"{self._BASE}/release:chat", headers=self._headers(), json=payload
        )
        resp = await self._get_client().send(request, stream=True)
        try:
            if resp.status_code != 200:
                body = (await resp.aread())[:300].decode("utf-8", "ignore")
                logger.warning("SenseCore RAG 流式调用失败: HTTP %s %s", resp.status_code, body)
                raise httpx.HTTPStatusError(
                    f"SenseCore RAG stream HTTP {resp.status_code}", request=request, response=resp
                )
            async for line in resp.aiter_lines():
                yield line
        finally:
            await resp.aclose()

    # ---------- 内部请求 ----------

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        try:
            resp = await self._get_client().post(
                f"{self._BASE}{path}", headers=self._headers(), json=payload
            )
            if resp.status_code != 200:
                logger.warning("SenseCore RAG %s 失败: HTTP %s %s", path, resp.status_code, resp.text[:300])
                return None
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - 外部服务降级
            logger.warning("SenseCore RAG %s 异常（降级模式）: %s", path, exc)
            return None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


_rag_client: SenseCoreRagClient | None = None


def get_rag_client() -> SenseCoreRagClient:
    """模块级单例。"""
    global _rag_client
    if _rag_client is None:
        _rag_client = SenseCoreRagClient()
    return _rag_client
