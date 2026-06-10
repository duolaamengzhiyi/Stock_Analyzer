"""T076：清理任务的 60 日 / 7 日 / 30 日三段窗口。

覆盖：
- stock_daily 删 trade_date < 第 60 个交易日（FR-022）
- news_items 删 published_at < now - 7d（FR-031）
- long_lived_tokens 删 revoked_at < now - 30d
- 写 audit success
"""

from __future__ import annotations

from typing import Any

import pytest

from sealos.scheduler.jobs import cleanup


@pytest.fixture
def mocks(monkeypatch, fake_supabase):
    monkeypatch.setattr(
        "sealos.scheduler.jobs.cleanup.get_supabase_client",
        lambda: fake_supabase.client,
    )
    audit_calls: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "sealos.scheduler.jobs.cleanup.write_audit",
        lambda **kw: audit_calls.append(kw),
    )
    return fake_supabase, audit_calls


async def test_cleanup_runs_all_three_windows(mocks) -> None:
    fake_supabase, audit_calls = mocks
    # 日历提供 60 个交易日，确保 stock_daily 清理边界存在
    fake_supabase.set_data(
        "market_calendar",
        [{"date": f"2026-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}"} for i in range(60)],
        action="select",
    )

    result = await cleanup.run()
    assert result["status"] == "success"

    deletes = [c for c in fake_supabase.calls if c["action"] == "delete"]
    deleted_tables = {c["table"] for c in deletes}
    assert "stock_daily" in deleted_tables
    assert "news_items" in deleted_tables
    assert "long_lived_tokens" in deleted_tables

    # 必须写 audit success
    assert any(c.get("status") == "success" and c.get("kind") == "cleanup" for c in audit_calls)


async def test_cleanup_skips_stock_daily_when_calendar_short(mocks) -> None:
    fake_supabase, audit_calls = mocks
    # 日历仅 5 条 → 不足 60 → 跳过 stock_daily 清理
    fake_supabase.set_data(
        "market_calendar",
        [{"date": "2026-04-22"}] * 5,
        action="select",
    )

    result = await cleanup.run()
    assert result["status"] == "success"
    deletes = [c for c in fake_supabase.calls if c["action"] == "delete"]
    deleted_tables = [c["table"] for c in deletes]
    # 仍清 news_items / long_lived_tokens
    assert "news_items" in deleted_tables
    assert "long_lived_tokens" in deleted_tables
    # 但跳过 stock_daily
    assert "stock_daily" not in deleted_tables
