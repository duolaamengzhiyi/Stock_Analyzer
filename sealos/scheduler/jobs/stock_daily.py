"""每日行情抓取 job · midday & close。

- midday: 11:30 后抓盘中快照，写 stocks + stock_daily
- close: 15:15 后抓收盘快照，写 stocks + stock_daily（Phase 5 在尾部嵌入筛选）

公共流程：
1. 校验 A 股是否开市（market_calendar.is_open == true）；否则写 audit skipped 退出
2. 调 AKTools `stock_zh_a_spot_em` 拉全量快照
3. UPSERT stocks（市值 / ST 标记可能变化）
4. UPSERT stock_daily WHERE trade_date=today
5. 滚动清理 60 交易日窗口外的旧行情
6. 写 audit success；广播 Realtime 事件

失败语义（FR-023）：
- 任何步骤抛异常 → audit failed；既有数据保持不变（UPSERT 是幂等的；清理只在成功路径执行）
- 不广播 Realtime
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sealos.scheduler.audit import write_audit
from sealos.scheduler.clients.aktools import aktools_request
from sealos.scheduler.clients.supabase import get_supabase_client
from sealos.scheduler.realtime.publish import publish_event

logger = logging.getLogger(__name__)
TZ_CN = ZoneInfo("Asia/Shanghai")


def _today_iso() -> str:
    return datetime.now(tz=TZ_CN).date().isoformat()


def _is_a_share_open(client: Any, today: str) -> bool:
    """读 market_calendar 判定 A 股 today 是否开市。"""
    res = (
        client.table("market_calendar")
        .select("is_open")
        .eq("market", "CN_A")
        .eq("date", today)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        # 日历未覆盖时保守跳过（FR-124）
        return False
    return bool(rows[0].get("is_open"))


def _classify_market(code: str) -> str:
    if code.startswith("688"):
        return "STAR"
    if code.startswith(("300", "301")):
        return "GEM"
    if code.startswith(("8", "43", "92")):
        return "BJ"
    return "MAIN"


def _spot_to_rows(
    spot: list[dict[str, Any]], today: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """把 stock_zh_a_spot_em 返回拆成 stocks + stock_daily 两个 upsert payload。"""
    snapshot_at = datetime.now(tz=TZ_CN).isoformat()
    stocks_rows: list[dict[str, Any]] = []
    daily_rows: list[dict[str, Any]] = []
    for row in spot:
        code = str(row.get("代码") or row.get("code") or "").strip()
        if not code or len(code) != 6 or not code.isdigit():
            continue
        name = (row.get("名称") or row.get("name") or "").strip()
        market = _classify_market(code)
        is_st = "ST" in name.upper()

        stocks_rows.append(
            {
                "code": code,
                "name": name,
                "market": market,
                "is_st": is_st,
                "latest_market_cap": row.get("总市值") or row.get("market_cap"),
                "latest_snapshot_at": snapshot_at,
            }
        )
        daily_rows.append(
            {
                "code": code,
                "trade_date": today,
                "open": row.get("今开") or row.get("open"),
                "high": row.get("最高") or row.get("high"),
                "low": row.get("最低") or row.get("low"),
                "close": row.get("最新价") or row.get("close"),
                "volume": row.get("成交量") or row.get("volume") or 0,
                "turnover": row.get("成交额") or row.get("turnover"),
                "change_pct": row.get("涨跌幅") or row.get("change_pct"),
            }
        )
    return stocks_rows, daily_rows


def _cleanup_60d_window(client: Any, today: str) -> None:
    """删除 trade_date 早于 today 倒数第 60 个 A 股交易日的 stock_daily 行（FR-022）。"""
    cal = (
        client.table("market_calendar")
        .select("date")
        .eq("market", "CN_A")
        .eq("is_open", True)
        .lte("date", today)
        .order("date", desc=True)
        .limit(60)
        .execute()
    )
    rows = getattr(cal, "data", None) or []
    if len(rows) < 60:
        return  # 日历不足，先不清理
    boundary = rows[-1]["date"]  # 第 60 个交易日的日期
    client.table("stock_daily").delete().lt("trade_date", boundary).execute()


async def _run(kind: str) -> dict[str, Any]:
    """midday / close 公共流程。"""
    assert kind in ("midday", "close")
    today = _today_iso()
    client = get_supabase_client()

    if not _is_a_share_open(client, today):
        write_audit(
            kind="stock-fetch",
            status="skipped",
            subject=f"stock-daily-{kind}",
            meta={"reason": "A-share holiday", "trade_date": today},
        )
        return {"status": "skipped", "reason": "A-share holiday"}

    try:
        spot = await aktools_request("/api/public/stock_zh_a_spot_em")
        if not isinstance(spot, list):
            raise RuntimeError(f"AKTools 返回非列表：{type(spot).__name__}")
        stocks_rows, daily_rows = _spot_to_rows(spot, today)
        if not stocks_rows or not daily_rows:
            raise RuntimeError("AKTools 返回空快照或字段缺失")
        client.table("stocks").upsert(stocks_rows, on_conflict="code").execute()
        client.table("stock_daily").upsert(
            daily_rows, on_conflict="code,trade_date"
        ).execute()
        _cleanup_60d_window(client, today)
    except Exception as e:  # noqa: BLE001
        write_audit(
            kind="stock-fetch",
            status="failed",
            subject=f"stock-daily-{kind}",
            error_detail=str(e),
            meta={"trade_date": today},
        )
        raise

    write_audit(
        kind="stock-fetch",
        status="success",
        subject=f"stock-daily-{kind}",
        meta={"trade_date": today, "rows": len(daily_rows)},
    )

    publish_event(
        kind=f"stock-daily-{kind}",
        affected_boards=[
            "indices",
            "launching-soon",
            "main-uptrend",
            "watchlist",
            "market-status",
        ],
        trade_date=today,
    )
    return {"status": "success", "trade_date": today, "rows": len(daily_rows)}


async def run_midday() -> dict[str, Any]:
    """11:30 抓盘中快照（cron + /trigger 入口）。"""
    return await _run("midday")


async def run_close() -> dict[str, Any]:
    """15:15 抓收盘快照（cron + /trigger 入口）。Phase 5 将在尾部嵌入筛选预计算。"""
    return await _run("close")


def run_midday_sync() -> dict[str, Any]:
    """供同步上下文（如手动脚本）调用。"""
    return asyncio.run(run_midday())


def run_close_sync() -> dict[str, Any]:
    return asyncio.run(run_close())
