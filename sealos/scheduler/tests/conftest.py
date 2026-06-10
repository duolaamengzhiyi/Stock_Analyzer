"""
sealos/scheduler 测试公共 fixture。

- 用 respx mock httpx，确保 AKTools / DeepSeek / Supabase HTTP 调用在测试中不真实联网
- 默认环境变量注入虚拟值，避免 config.py 在 import 时报错
"""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest
import respx


# ---- 环境变量预置：必须在 import 业务代码之前 -------------------
def pytest_configure() -> None:
    os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")
    os.environ.setdefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    os.environ.setdefault("AKTOOLS_BASE_URL", "http://aktools.test.local")
    os.environ.setdefault("TZ", "Asia/Shanghai")


@pytest.fixture
def mock_httpx() -> Generator[respx.MockRouter, None, None]:
    """开启 respx 拦截，所有未注册的 httpx 请求会抛错。"""
    with respx.mock(assert_all_called=False) as router:
        yield router
