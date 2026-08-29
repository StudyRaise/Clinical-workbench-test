"""SenseCore RAG 客户端鉴权逻辑单元测试（不发起真实网络请求）。"""
from __future__ import annotations

import re
from email.utils import parsedate_to_datetime

import pytest

from app.services.sensecore_rag_client import (
    SenseCoreConfigError,
    SenseCoreRagClient,
    _hmac_auth_headers,
)


def _make_client(
    bearer: str = "", access_key: str = "", secret_key: str = ""
) -> SenseCoreRagClient:
    client = SenseCoreRagClient.__new__(SenseCoreRagClient)
    client.release_key = "test-release-key"
    client.bearer_token = bearer
    client.access_key = access_key
    client.secret_key = secret_key
    client._client = None
    return client


class TestHmacAuthHeaders:
    def test_x_date_is_rfc1123_gmt(self):
        headers = _hmac_auth_headers("AK", "SK")
        assert headers["X-Date"].endswith("GMT")
        # 可被解析为合法日期
        parsed = parsedate_to_datetime(headers["X-Date"])
        assert parsed.tzinfo is not None

    def test_authorization_format(self):
        headers = _hmac_auth_headers("my-ak", "my-sk")
        auth = headers["Authorization"]
        assert auth.startswith('hmac accesskey="my-ak"')
        assert 'algorithm="hmac-sha256"' in auth
        assert 'headers="x-date"' in auth
        assert re.search(r'signature="[A-Za-z0-9+/=]+"', auth)

    def test_signature_depends_on_secret(self):
        h1 = _hmac_auth_headers("AK", "secret-1")
        h2 = _hmac_auth_headers("AK", "secret-2")
        assert h1["Authorization"] != h2["Authorization"]


class TestAuthHeaders:
    def test_bearer_token_takes_priority(self):
        client = _make_client(bearer="abc123", access_key="AK", secret_key="SK")
        assert client._auth_headers() == {"Authorization": "Bearer abc123"}

    def test_bearer_token_with_scheme_kept_as_is(self):
        client = _make_client(bearer="hmac accesskey=\"x\"")
        assert client._auth_headers() == {"Authorization": 'hmac accesskey="x"'}

    def test_aksk_fallback_generates_hmac(self):
        client = _make_client(access_key="AK", secret_key="SK")
        headers = client._auth_headers()
        assert headers["Authorization"].startswith('hmac accesskey="AK"')
        assert "X-Date" in headers

    def test_no_credentials_raises(self):
        client = _make_client()
        with pytest.raises(SenseCoreConfigError):
            client._auth_headers()

    def test_missing_release_key_raises(self):
        client = _make_client(access_key="AK", secret_key="SK")
        client.release_key = ""
        with pytest.raises(SenseCoreConfigError):
            client._check_configured()
