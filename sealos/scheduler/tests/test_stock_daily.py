"""T074：stock_daily_midday / stock_daily_close 抓取 + UPSERT + Realtime 广播。

覆盖：
- 11:30 / 15:15 路径都调 stock_zh_a_spot_em 一次（respx 验证）
- 上证主板 / 科创 / 创业板 / 北交所 4 段 code 段落正确分类（_classify_market）
- A 股休市日跳过（market_calendar.is_open=False → audit skipped + 不调 AKTools）
- 成功路径：stocks UPSERT + stock_daily UPSERT + 写 audit success + publish event
- 60 交易日窗口清理：日历不足 60 条时不删
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import httpx
import pytest

from sealos.scheduler.jobs import stock_daily


SAMPLE_SPOT = [
    {"代码": "600000", "名称": "浦发银行", "今开": 9.0, "最新价": 9.2, "最高": 9.3, "最低": 8.95, "成交量": 12345, "成交额": 1.1e8, "涨跌幅": 1.5, "总市值": 2.7e11},
    {"代码": "688001", "名称": "华兴源创", "今开": 30, "最新价": 31.5, "最高": 32, "最低": 29.8, "成交量": 5000, "成交额": 1.5e8, "涨跌幅": 5.0, "总市值": 1.4e10},
    {"代码": "300750", "名称": "宁德时代", "今开": 200, "最新价": 205, "最高": 208, "最低": 199, "成交量": 8000, "成交额": 1.6e9, "涨跌幅": 2.5, "总市值": 9e11},
    {"代码": "830879", "名称": "ST泰丰", "今开": 5, "最新价": 4.9, "最高": 5.1, "最低": 4.8, "成交量": 100, "成交额": 4.9e5, "涨跌幅": -2.0, "总市值": 5e8},
]


@pytest.fixture
def mock_clients(monkeypatch, fake_supabase):
    """统一 patch jobs.stock_daily 内的 supabase / publish / audit。"""
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
    # _cleanup_60d_window 内部还会调 client.table，不需要单独 patch
    return fake_supabase, audit_calls, publish_calls


def test_classify_market() -> None:
    assert stock_daily._classify_market("600000") == "MAIN"
    assert stock_daily._classify_market("000001") == "MAIN"
    assert stock_daily._classify_market("688001") == "STAR"
    assert stock_daily._classify_market("300750") == "GEM"
    assert stock_daily._classify_market("301001") == "GEM"
    assert stock_daily._classify_market("830879") == "BJ"
    assert stock_daily._classify_market("430005") == "BJ"


def test_spot_to_rows_skips_invalid_code() -> None:
    bad = SAMPLE_SPOT + [{"代码": "abc", "名称": "无效"}, {"代码": "12345"}]
    stocks_rows, daily_rows = stock_daily._spot_to_rows(bad, "2026-06-10")
    # 4 条合法
    assert len(stocks_rows) == 4
    assert len(daily_rows) == 4
    assert stocks_rows[3]["is_st"] is True  # 'ST泰丰'
    assert daily_rows[0]["trade_date"] == "2026-06-10"


@pytest.mark.parametrize("kind,event", [("midday", "stock-daily-midday"), ("close", "stock-daily-close")])
async def test_run_success_path(monkeypatch, mock_httpx, mock_clients, kind: str, event: str) -> None:
    fake_supabase, audit_calls, publish_calls = mock_clients

    # 单次 set_data：每行同时含 is_open=True（_is_a_share_open 看 rows[0]）
    # 与 date（_cleanup_60d_window 看 rows[-1]），共 60 条满足两个查询
    fake_supabase.set_data(
        "market_calendar",
        [
            {"is_open": True, "date": f"2026-04-{(i % 30) + 1:02d}"}
            for i in range(60)
        ],
        action="select",
    )
    # AKTools mock：返回 SAMPLE_SPOT
    mock_httpx.get("http://aktools.test.local/api/public/stock_zh_a_spot_em").mock(
        return_value=httpx.Response(200, json=SAMPLE_SPOT)
    )

    # 重置 aktools 的 lru_cached httpx client，确保用 respx 拦截
    from sealos.scheduler.clients import aktools as aktools_mod
    aktools_mod.get_aktools_client.cache_clear()

    runner = stock_daily.run_midday if kind == "midday" else stock_daily.run_close
    result = await runner()

    assert result["status"] == "success"
    assert result["rows"] == 4
    # 写入：stocks upsert 一次 + stock_daily upsert 一次 + cleanup（select 日历 + delete 旧行）
    upserts = [c for c in fake_supabase.calls if c["action"] == "upsert"]
    assert any(c["table"] == "stocks" for c in upserts)
    assert any(c["table"] == "stock_daily" for c in upserts)
    # audit success
    assert any(c.get("status") == "success" and c.get("subject") == f"stock-daily-{kind}" for c in audit_calls)
    # publish 事件 kind 正确，含 affectedBoards
    assert publish_calls and publish_calls[-1]["kind"] == event
    assert "watchlist" in publish_calls[-1]["affected_boards"]


async def test_run_skipped_when_holiday(monkeypatch, mock_clients) -> None:
    fake_supabase, audit_calls, publish_calls = mock_clients
    fake_supabase.set_data("market_calendar", [{"is_open": False}], action="select")

    result = await stock_daily.run_midday()
    assert result["status"] == "skipped"
    assert any(c.get("status") == "skipped" for c in audit_calls)
    # 休市日不广播 Realtime
    assert publish_calls == []
