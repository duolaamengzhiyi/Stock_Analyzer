"""5 市场交易日历刷新 job（FR-120 / SC-052）。

覆盖窗口：过去 ≥ 180 天 + 未来 ≥ 30 天（FR-120）。

数据来源：
- A 股（CN_A）：AKTools tool_trade_date_hist_sina（历史已确认的交易日）+
  pandas-market-calendars 'XSHG' 排出未来 30 天
- US：'XNYS'
- HK：'XHKG'
- JP：'XTKS'
- KR：'XKRX'

写入：UPSERT market_calendar (market, date) → is_open；删除窗口外旧数据。
完成后广播 calendar-refresh-done（affectedBoards=['market-status']）。
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sealos.scheduler.audit import write_audit
from sealos.scheduler.clients.aktools import aktools_request
from sealos.scheduler.clients.supabase import get_supabase_client
from sealos.scheduler.realtime.publish import publish_event

logger = logging.getLogger(__name__)
TZ_CN = ZoneInfo("Asia/Shanghai")

# market_calendar.market 枚举与 pandas-market-calendars 名称的映射
MARKET_PMC_MAP: dict[str, str] = {
    "CN_A": "XSHG",
    "US": "XNYS",
    "HK": "XHKG",
    "JP": "XTKS",
    "KR": "XKRX",
}

# 覆盖窗口（FR-120）：过去 180 + 未来 30 天
PAST_DAYS = 180
FUTURE_DAYS = 30


def _date_range(today: datetime) -> tuple[str, str]:
    start = (today - timedelta(days=PAST_DAYS)).date().isoformat()
    end = (today + timedelta(days=FUTURE_DAYS)).date().isoformat()
    return start, end


def _generate_market_rows(market: str, start: str, end: str) -> list[dict[str, Any]]:
    """用 pandas-market-calendars 生成指定市场的开市日历行（is_open=True/False 全量天）。"""
    import pandas as pd  # 延迟 import：测试可 monkeypatch _generate_market_rows
    import pandas_market_calendars as mcal

    pmc_name = MARKET_PMC_MAP[market]
    cal = mcal.get_calendar(pmc_name)
    open_days = cal.valid_days(start_date=start, end_date=end)
    open_set: set[str] = {d.strftime("%Y-%m-%d") for d in open_days}

    all_dates = pd.date_range(start=start, end=end, freq="D")
    return [
        {
            "market": market,
            "date": d.strftime("%Y-%m-%d"),
            "is_open": d.strftime("%Y-%m-%d") in open_set,
        }
        for d in all_dates
    ]


async def _aktools_cn_trading_dates(start: str, end: str) -> set[str]:
    """从 AKTools 拉 CN_A 历史已确认的交易日，与 pmc 推算结果做交叉校验。

    优先用 AKTools 的实际历史数据（含临时停市等公告），未来日期回落到 pmc。
    """
    try:
        cal = await aktools_request("/api/public/tool_trade_date_hist_sina")
    except Exception as e:  # noqa: BLE001
        logger.warning("AKTools 交易日列表拉取失败，回退至 pmc：%s", e)
        return set()
    if not isinstance(cal, list):
        return set()
    dates: set[str] = set()
    for item in cal:
        d = item.get("trade_date") or item.get("date") or item.get("calendarDate")
        if isinstance(d, str):
            d10 = d[:10]
            if start <= d10 <= end:
                dates.add(d10)
    return dates


async def run() -> dict[str, Any]:
    today_dt = datetime.now(tz=TZ_CN)
    today = today_dt.date().isoformat()
    start, end = _date_range(today_dt)
    client = get_supabase_client()

    try:
        all_rows: list[dict[str, Any]] = []
        cn_authoritative = await _aktools_cn_trading_dates(start, end)

        for market in MARKET_PMC_MAP.keys():
            rows = _generate_market_rows(market, start, end)
            if market == "CN_A" and cn_authoritative:
                # 覆盖：AKTools 已确认的历史交易日优先于 pmc 推算
                for r in rows:
                    if r["date"] in cn_authoritative and r["date"] <= today:
                        r["is_open"] = True
            all_rows.extend(rows)

        # UPSERT
        client.table("market_calendar").upsert(
            all_rows, on_conflict="market,date"
        ).execute()
        # 清理窗口外
        client.table("market_calendar").delete().lt("date", start).execute()
    except Exception as e:  # noqa: BLE001
        write_audit(
            kind="calendar-refresh",
            status="failed",
            subject="run",
            error_detail=str(e),
            meta={"window_start": start, "window_end": end},
        )
        raise

    write_audit(
        kind="calendar-refresh",
        status="success",
        subject="run",
        meta={"window_start": start, "window_end": end, "rows": len(all_rows)},
    )

    publish_event(
        kind="calendar-refresh-done",
        affected_boards=["market-status"],
    )
    return {
        "status": "success",
        "window_start": start,
        "window_end": end,
        "rows": len(all_rows),
    }
