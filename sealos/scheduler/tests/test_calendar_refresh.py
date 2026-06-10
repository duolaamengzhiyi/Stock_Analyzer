"""T077：5 市场日历刷新 covers 过去 ≥180 天 + 未来 ≥30 天（FR-120 / SC-052）。

覆盖：
- pmc 推算结果包含 5 个市场（CN_A / US / HK / JP / KR）的所有日期行
- 窗口长度 ≥ 180 + 30 + 1 天（含端点）
- 写 audit success；广播 calendar-refresh-done（affectedBoards=['market-status']）
- AKTools 失败回退：交易日校验集合为空仍能完成（pmc 兜底）
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest

from sealos.scheduler.jobs import calendar_refresh


TZ_CN = ZoneInfo("Asia/Shanghai")


def _fake_pmc_rows(market: str, start: str, end: str) -> list[dict[str, Any]]:
    """绕开 pandas-market-calendars 的真实计算：每个日期都标 is_open=True。

    测试目的是验证窗口长度 + 5 市场齐全，而不是校验 pmc 正确性。
    """
    sd = date.fromisoformat(start)
    ed = date.fromisoformat(end)
    rows = []
    cur = sd
    while cur <= ed:
        rows.append(
            {
                "market": market,
                "date": cur.isoformat(),
                "is_open": True,
            }
        )
        cur += timedelta(days=1)
    return rows


@pytest.fixture
def mocks(monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "sealos.scheduler.jobs.calendar_refresh.get_supabase_client",
        lambda: fake_supabase.client,
    )
    audit_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.calendar_refresh.write_audit",
        lambda **kw: audit_calls.append(kw),
    )
    publish_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.calendar_refresh.publish_event",
        lambda **kw: publish_calls.append(kw),
    )
    monkeypatch.setattr(
        "sealos.scheduler.jobs.calendar_refresh._generate_market_rows",
        _fake_pmc_rows,
    )
    from sealos.scheduler.clients import aktools as aktools_mod
    aktools_mod.get_aktools_client.cache_clear()
    return fake_supabase, audit_calls, publish_calls


async def test_calendar_refresh_covers_window_and_markets(mock_httpx, mocks) -> None:
    fake_supabase, audit_calls, publish_calls = mocks
    # AKTools 返回近期 3 条历史交易日（用于 CN_A 校验）
    today = datetime.now(tz=TZ_CN).date()
    mock_httpx.get(
        "http://aktools.test.local/api/public/tool_trade_date_hist_sina"
    ).mock(
        return_value=httpx.Response(
            200,
            json=[
                {"trade_date": (today - timedelta(days=1)).isoformat()},
                {"trade_date": (today - timedelta(days=2)).isoformat()},
                {"trade_date": (today - timedelta(days=3)).isoformat()},
            ],
        )
    )

    result = await calendar_refresh.run()
    assert result["status"] == "success"

    upserts = [c for c in fake_supabase.calls if c["action"] == "upsert" and c["table"] == "market_calendar"]
    assert len(upserts) == 1
    rows = upserts[0]["args"][0]
    markets = {r["market"] for r in rows}
    assert markets == {"CN_A", "US", "HK", "JP", "KR"}

    # 窗口长度：每个市场至少 180 + 30 + 1 = 211 天（fake pmc 每天一行）
    per_market_count = sum(1 for r in rows if r["market"] == "CN_A")
    assert per_market_count >= 211

    # publish 必须含 calendar-refresh-done + market-status
    assert publish_calls, "calendar_refresh 未广播事件"
    assert publish_calls[-1]["kind"] == "calendar-refresh-done"
    assert publish_calls[-1]["affected_boards"] == ["market-status"]

    assert any(c.get("status") == "success" and c.get("kind") == "calendar-refresh" for c in audit_calls)


async def test_calendar_refresh_falls_back_when_aktools_fails(mock_httpx, mocks) -> None:
    fake_supabase, audit_calls, publish_calls = mocks
    mock_httpx.get(
        "http://aktools.test.local/api/public/tool_trade_date_hist_sina"
    ).mock(side_effect=httpx.ConnectError("network down"))

    result = await calendar_refresh.run()
    # AKTools 失败仍能完成（pmc 兜底）
    assert result["status"] == "success"
    assert publish_calls and publish_calls[-1]["kind"] == "calendar-refresh-done"
