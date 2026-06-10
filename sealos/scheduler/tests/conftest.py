"""sealos/scheduler 测试公共 fixture。

- 用 respx mock httpx，确保 AKTools / DeepSeek / Supabase HTTP 调用在测试中不真实联网
- 默认环境变量注入虚拟值，避免 config.py 在 import 时报错
- 提供 fake_supabase_client：用 MagicMock 模拟 supabase-py 的 chainable client API
"""

from __future__ import annotations

import os
from collections.abc import Generator
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
import respx


# ---- 环境变量预置：必须在 import 业务代码之前 -------------------
def pytest_configure() -> None:
    os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")
    os.environ.setdefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    os.environ.setdefault("AKTOOLS_BASE_URL", "http://aktools.test.local")
    os.environ.setdefault("SCHEDULER_AUTH_TOKEN", "test-trigger-token")
    os.environ.setdefault("TZ", "Asia/Shanghai")


@pytest.fixture
def mock_httpx() -> Generator[respx.MockRouter, None, None]:
    """开启 respx 拦截，所有未注册的 httpx 请求会抛错。"""
    with respx.mock(assert_all_called=False) as router:
        yield router


# ---- supabase-py chain mock --------------------------------------
class _FakeQuery:
    """模拟 supabase-py 的链式查询对象。

    - 任何 .table(name) 后续调用（select/insert/upsert/delete/eq/lte/lt/gt/order/limit）
      返回 self，便于链式
    - .execute() 返回预先放好的 SimpleNamespace(data=...)；可通过 set_data(name, data)
      或 set_data(name, action, data) 配置不同表 / 不同动作的返回
    - 同时把每次 .execute() 调用记录到 .calls，便于断言

    用法：
        sb = make_fake_supabase()
        sb.set_data("market_calendar", [{"is_open": True}])
        # 或针对具体动作：
        sb.set_data("audit_logs", action="select", data=[])
        client = sb.client
    """


def _empty_data() -> SimpleNamespace:
    return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self) -> None:
        # 表数据 / 动作数据
        self._table_data: dict[tuple[str, str], list[Any]] = {}
        self._default_data: dict[str, list[Any]] = {}
        self.calls: list[dict[str, Any]] = []
        self._client = MagicMock(name="FakeSupabaseClient")

        # 实例 + 链式
        def table_factory(name: str):
            return _ChainBuilder(self, name)

        self._client.table.side_effect = table_factory
        # realtime 兜底（publish_event 可能调用，但默认不报错）
        self._client.realtime = MagicMock()

    @property
    def client(self) -> Any:
        return self._client

    def set_data(
        self,
        table: str,
        data: list[Any],
        *,
        action: str = "*",
    ) -> None:
        """配置某表 + 某动作（select/upsert/delete/insert/update/*）的 .execute() 返回 data。"""
        if action == "*":
            self._default_data[table] = data
        else:
            self._table_data[(table, action)] = data

    def _resolve_data(self, table: str, action: str) -> list[Any]:
        if (table, action) in self._table_data:
            return self._table_data[(table, action)]
        return self._default_data.get(table, [])


class _ChainBuilder:
    """每个 .table(name) 调用产生一个独立链对象，记录 action + 参数。"""

    _CHAINABLE = (
        "select",
        "insert",
        "upsert",
        "delete",
        "update",
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "order",
        "limit",
        "in_",
        "is_",
    )

    def __init__(self, parent: FakeSupabase, table: str) -> None:
        self._parent = parent
        self._table = table
        self._action: str = "select"
        self._action_args: tuple[Any, ...] = ()
        self._action_kwargs: dict[str, Any] = {}
        self._filters: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def __getattr__(self, item: str) -> Any:
        if item in self._CHAINABLE:

            def _record(*args: Any, **kwargs: Any) -> "_ChainBuilder":
                if item in ("select", "insert", "upsert", "delete", "update"):
                    self._action = item
                    self._action_args = args
                    self._action_kwargs = kwargs
                else:
                    self._filters.append((item, args, kwargs))
                return self

            return _record
        raise AttributeError(item)

    def execute(self) -> SimpleNamespace:
        call = {
            "table": self._table,
            "action": self._action,
            "args": self._action_args,
            "kwargs": self._action_kwargs,
            "filters": list(self._filters),
        }
        self._parent.calls.append(call)
        data = self._parent._resolve_data(self._table, self._action)
        return SimpleNamespace(data=data)


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase()
