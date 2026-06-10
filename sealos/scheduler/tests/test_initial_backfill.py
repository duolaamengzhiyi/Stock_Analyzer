"""T075：首次历史回填幂等性 + 主流程。

覆盖：
- audit_logs 中已有 kind='initial-backfill' status='success' → 跳过（不再调 AKTools）
- 首次：调 spot 拿 stocks，调 tool_trade_date_hist_sina 拿日历，调 stock_zh_a_hist 拉历史，
  最后写入 stocks + stock_daily（数量 ≥ 输入条数）
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import httpx
import pytest

from sealos.scheduler.jobs import initial_backfill


@pytest.fixture
def mocks(monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "sealos.scheduler.jobs.initial_backfill.get_supabase_client",
        lambda: fake_supabase.client,
    )
    audit_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.initial_backfill.write_audit",
        lambda **kw: audit_calls.append(kw),
    )
    from sealos.scheduler.clients import aktools as aktools_mod
    aktools_mod.get_aktools_client.cache_clear()
    return fake_supabase, audit_calls


async def test_skip_when_already_done(monkeypatch, mocks) -> None:
    fake_supabase, audit_calls = mocks
    # audit_logs 已有 success
    fake_supabase.set_data("audit_logs", [{"id": "uuid-1"}], action="select")

    result = await initial_backfill.run()
    assert result["status"] == "skipped"
    assert any(c.get("status") == "skipped" and c.get("subject") == "already-done" for c in audit_calls)


async def test_full_backfill_path(monkeypatch, mock_httpx, mocks) -> None:
    fake_supabase, audit_calls = mocks
    # audit_logs 没记录
    fake_supabase.set_data("audit_logs", [], action="select")

    spot_rows = [
        {"代码": "600000", "名称": "浦发银行", "今开": 9, "最新价": 9.2, "最高": 9.3, "最低": 9, "成交量": 100, "成交额": 1e7, "涨跌幅": 1, "总市值": 1e11},
        {"代码": "300750", "名称": "宁德时代", "今开": 200, "最新价": 205, "最高": 208, "最低": 199, "成交量": 100, "成交额": 1e8, "涨跌幅": 2, "总市值": 9e11},
    ]
    cal_rows = [{"trade_date": "2026-04-22"}, {"trade_date": "2026-04-21"}, {"trade_date": "2026-04-20"}]

    mock_httpx.get("http://aktools.test.local/api/public/stock_zh_a_spot_em").mock(
        return_value=httpx.Response(200, json=spot_rows)
    )
    mock_httpx.get("http://aktools.test.local/api/public/tool_trade_date_hist_sina").mock(
        return_value=httpx.Response(200, json=cal_rows)
    )
    # 每只股票的 hist
    hist_rows = [
        {"日期": "2026-04-22", "开盘": 9, "收盘": 9.2, "最高": 9.3, "最低": 9, "成交量": 100, "成交额": 1e7, "涨跌幅": 1.5},
        {"日期": "2026-04-21", "开盘": 8.9, "收盘": 9, "最高": 9.1, "最低": 8.85, "成交量": 90, "成交额": 9e6, "涨跌幅": 0.5},
    ]
    mock_httpx.get("http://aktools.test.local/api/public/stock_zh_a_hist").mock(
        return_value=httpx.Response(200, json=hist_rows)
    )

    result = await initial_backfill.run()
    assert result["status"] == "success"
    assert result["stocks"] == 2
    # stock_daily 至少有 4 条（2 只 × 2 日 hist）
    assert result["daily_rows"] >= 4
    # 必须 upsert stocks + stock_daily
    upserts = [c for c in fake_supabase.calls if c["action"] == "upsert"]
    assert any(c["table"] == "stocks" for c in upserts)
    assert any(c["table"] == "stock_daily" for c in upserts)
    assert any(c.get("status") == "success" and c.get("subject") == "run" for c in audit_calls)
