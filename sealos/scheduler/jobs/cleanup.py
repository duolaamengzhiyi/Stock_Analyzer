"""每日清理 job（凌晨 04:00）。

按 contracts/sealos-jobs.md：
1. DELETE stock_daily WHERE trade_date < (最近一个 A 股交易日 - 60d)（FR-022）
2. DELETE news_items WHERE published_at < now() - 7d（FR-031）
3. DELETE long_lived_tokens WHERE revoked_at < now() - 30d
4. audit_logs success；不广播 Realtime（清理对用户无感）

注意：ai_artifacts 不清理（FR-052，AI 历史永久保留）。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sealos.scheduler.audit import write_audit
from sealos.scheduler.clients.supabase import get_supabase_client

TZ_CN = ZoneInfo("Asia/Shanghai")


def _last_60th_trading_day(client: Any, today: str) -> str | None:
    """取 today 倒数第 60 个 A 股交易日的日期（含 today，若 today 是交易日）。"""
    res = (
        client.table("market_calendar")
        .select("date")
        .eq("market", "CN_A")
        .eq("is_open", True)
        .lte("date", today)
        .order("date", desc=True)
        .limit(60)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if len(rows) < 60:
        return None
    return rows[-1]["date"]


async def run() -> dict[str, Any]:
    today_dt = datetime.now(tz=TZ_CN)
    today = today_dt.date().isoformat()
    client = get_supabase_client()

    counts = {"stock_daily": 0, "news_items": 0, "long_lived_tokens": 0}

    try:
        # 1. stock_daily 60 交易日窗口
        boundary = _last_60th_trading_day(client, today)
        if boundary is not None:
            res = (
                client.table("stock_daily").delete().lt("trade_date", boundary).execute()
            )
            counts["stock_daily"] = len(getattr(res, "data", None) or [])

        # 2. news_items 7 天窗口
        seven_days_ago = (today_dt - timedelta(days=7)).isoformat()
        res = (
            client.table("news_items")
            .delete()
            .lt("published_at", seven_days_ago)
            .execute()
        )
        counts["news_items"] = len(getattr(res, "data", None) or [])

        # 3. long_lived_tokens 已撤销 30 天
        thirty_days_ago = (today_dt - timedelta(days=30)).isoformat()
        res = (
            client.table("long_lived_tokens")
            .delete()
            .lt("revoked_at", thirty_days_ago)
            .execute()
        )
        counts["long_lived_tokens"] = len(getattr(res, "data", None) or [])
    except Exception as e:  # noqa: BLE001
        write_audit(
            kind="cleanup",
            status="failed",
            subject="run",
            error_detail=str(e),
            meta={"trade_date": today},
        )
        raise

    write_audit(
        kind="cleanup",
        status="success",
        subject="run",
        meta={"trade_date": today, **counts},
    )
    return {"status": "success", **counts}
