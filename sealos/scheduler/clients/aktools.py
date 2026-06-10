"""AKTools HTTP 客户端封装（akfamily/aktools，Sealos 自部署）。

只暴露最小化接口；具体 endpoint 由 jobs/* 模块按需调用。
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx

from sealos.scheduler.config import get_settings


@lru_cache(maxsize=1)
def get_aktools_client() -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        base_url=settings.aktools_base_url,
        timeout=httpx.Timeout(30.0, connect=5.0),
    )


async def aktools_request(path: str, params: dict[str, Any] | None = None) -> Any:
    """通用 GET 调用，返回解析后的 JSON。"""
    client = get_aktools_client()
    resp = await client.get(path, params=params)
    resp.raise_for_status()
    return resp.json()
