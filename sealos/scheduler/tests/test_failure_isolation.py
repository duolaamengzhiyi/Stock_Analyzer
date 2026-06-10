"""T078：上游失败时，既有数据保留 + 写 audit failed（FR-023 / FR-031）。

覆盖：
- AKTools 抛 HTTP 错误 → stock_daily / stocks 不被 upsert
- audit_logs 写一条 status='failed'
- 不广播 Realtime 事件
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from sealos.scheduler.jobs import stock_daily


@pytest.fixture
def mocks(monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "sealos.scheduler.jobs.stock_daily.get_supabase_client",
        lambda: fake_supabase.client,
    )
    audit_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.stock_daily.write_audit",
        lambda **kw: audit_calls.append(kw),
    )
    publish_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.stock_daily.publish_event",
        lambda **kw: publish_calls.append(kw),
    )
    from sealos.scheduler.clients import aktools as aktools_mod
    aktools_mod.get_aktools_client.cache_clear()
    return fake_supabase, audit_calls, publish_calls


async def test_aktools_500_isolates_failure(mock_httpx, mocks) -> None:
    fake_supabase, audit_calls, publish_calls = mocks
    fake_supabase.set_data("market_calendar", [{"is_open": True}], action="select")
    mock_httpx.get(
        "http://aktools.test.local/api/public/stock_zh_a_spot_em"
    ).mock(return_value=httpx.Response(500, json={"error": "upstream"}))

    with pytest.raises(httpx.HTTPStatusError):
        await stock_daily.run_midday()

    # stocks / stock_daily 不应被 upsert
    upserts = [c for c in fake_supabase.calls if c["action"] == "upsert"]
    assert not any(c["table"] == "stocks" for c in upserts)
    assert not any(c["table"] == "stock_daily" for c in upserts)
    # audit failed 写过
    assert any(c.get("status") == "failed" and c.get("subject") == "stock-daily-midday" for c in audit_calls)
    # 不广播
    assert publish_calls == []


async def test_aktools_empty_response_treated_as_failure(mock_httpx, mocks) -> None:
    fake_supabase, audit_calls, publish_calls = mocks
    fake_supabase.set_data("market_calendar", [{"is_open": True}], action="select")
    mock_httpx.get(
        "http://aktools.test.local/api/public/stock_zh_a_spot_em"
    ).mock(return_value=httpx.Response(200, json=[]))  # 空列表

    with pytest.raises(RuntimeError, match="空快照|字段缺失"):
        await stock_daily.run_close()

    # 不应有任何 upsert
    upserts = [c for c in fake_supabase.calls if c["action"] == "upsert"]
    assert upserts == []
    assert any(c.get("status") == "failed" for c in audit_calls)
    assert publish_calls == []
