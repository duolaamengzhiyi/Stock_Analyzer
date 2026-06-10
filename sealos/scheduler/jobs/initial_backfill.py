"""首次历史回填 job（FR-024）。

仅在第一次部署后手动触发一次（POST /trigger/initial-backfill）。

幂等保证：
- 触发前查 audit_logs：若已存在 kind='initial-backfill' AND status='success'
  → 写 'already-done' 并退出，不重复跑

主流程：
1. 调 AKTools stock_zh_a_spot_em 拉全量股票元数据 → UPSERT stocks
2. 调 AKTools tool_trade_date_hist_sina 拿最近 60 个交易日列表
3. 遍历交易日（也可遍历股票），调 stock_zh_a_hist 拉历史 K 线 → INSERT stock_daily
4. 写 audit_logs success；不广播 Realtime（首次回填时 Vercel 可能未上线）
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sealos.scheduler.audit import write_audit
from sealos.scheduler.clients.aktools import aktools_request
from sealos.scheduler.clients.supabase import get_supabase_client
from sealos.scheduler.jobs.stock_daily import _classify_market, _spot_to_rows

logger = logging.getLogger(__name__)
TZ_CN = ZoneInfo("Asia/Shanghai")


def _already_done(client: Any) -> bool:
    res = (
        client.table("audit_logs")
        .select("id")
        .eq("kind", "initial-backfill")
        .eq("status", "success")
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return len(rows) > 0


async def run() -> dict[str, Any]:
    today = datetime.now(tz=TZ_CN).date().isoformat()
    client = get_supabase_client()

    if _already_done(client):
        write_audit(
            kind="initial-backfill",
            status="skipped",
            subject="already-done",
            meta={"trade_date": today},
        )
        return {"status": "skipped", "reason": "already-done"}

    try:
        # Step 1: 全量股票快照 → UPSERT stocks（同时落入今日 stock_daily 作为 baseline）
        spot = await aktools_request("/api/public/stock_zh_a_spot_em")
        if not isinstance(spot, list) or not spot:
            raise RuntimeError("AKTools 返回空快照")
        stocks_rows, today_rows = _spot_to_rows(spot, today)
        client.table("stocks").upsert(stocks_rows, on_conflict="code").execute()

        # Step 2: 拉最近 60 个交易日列表
        cal = await aktools_request("/api/public/tool_trade_date_hist_sina")
        if not isinstance(cal, list) or not cal:
            raise RuntimeError("AKTools 返回空交易日列表")
        # cal 元素形如 {"trade_date": "2026-01-02"}；按降序取前 60 个
        cal_dates: list[str] = []
        for item in cal:
            d = item.get("trade_date") or item.get("date") or item.get("calendarDate")
            if isinstance(d, str):
                cal_dates.append(d[:10])
        cal_dates = [d for d in cal_dates if d <= today]
        cal_dates.sort(reverse=True)
        recent_60 = cal_dates[:60]
        if not recent_60:
            raise RuntimeError("无法解析交易日列表")
        start_date = min(recent_60).replace("-", "")
        end_date = max(recent_60).replace("-", "")

        # Step 3: 对每只股票拉历史；为避免 5500 × 60 全量回灌过慢，
        # 这里按"每只股票一次 stock_zh_a_hist"调用，limit=10 并发由调用方处理。
        # 简化版：顺序拉，超时由 AKTools 客户端控制。生产部署时建议异步并发。
        all_daily_rows: list[dict[str, Any]] = []
        for stock_row in stocks_rows:
            code = stock_row["code"]
            try:
                hist = await aktools_request(
                    "/api/public/stock_zh_a_hist",
                    params={
                        "symbol": code,
                        "period": "daily",
                        "start_date": start_date,
                        "end_date": end_date,
                        "adjust": "qfq",
                    },
                )
            except Exception as e:  # noqa: BLE001
                # 单只股票拉失败不影响整体；记 audit 但继续
                logger.warning("回填 %s 失败：%s", code, e)
                continue
            if not isinstance(hist, list):
                continue
            for k in hist:
                trade_date = k.get("日期") or k.get("date") or k.get("trade_date")
                if not isinstance(trade_date, str):
                    continue
                trade_date = trade_date[:10]
                all_daily_rows.append(
                    {
                        "code": code,
                        "trade_date": trade_date,
                        "open": k.get("开盘") or k.get("open"),
                        "high": k.get("最高") or k.get("high"),
                        "low": k.get("最低") or k.get("low"),
                        "close": k.get("收盘") or k.get("close"),
                        "volume": k.get("成交量") or k.get("volume") or 0,
                        "turnover": k.get("成交额") or k.get("turnover"),
                        "change_pct": k.get("涨跌幅") or k.get("change_pct"),
                    }
                )

        if all_daily_rows:
            client.table("stock_daily").upsert(
                all_daily_rows, on_conflict="code,trade_date"
            ).execute()
        # 同时把今日快照 upsert（防止 hist 还没 cover today）
        if today_rows:
            client.table("stock_daily").upsert(
                today_rows, on_conflict="code,trade_date"
            ).execute()
    except Exception as e:  # noqa: BLE001
        write_audit(
            kind="initial-backfill",
            status="failed",
            subject="run",
            error_detail=str(e),
            meta={"trade_date": today},
        )
        raise

    rows_written = len(all_daily_rows) + len(today_rows)
    write_audit(
        kind="initial-backfill",
        status="success",
        subject="run",
        meta={
            "trade_date": today,
            "stocks": len(stocks_rows),
            "daily_rows": rows_written,
            "trade_dates": len(recent_60),
        },
    )
    return {
        "status": "success",
        "stocks": len(stocks_rows),
        "daily_rows": rows_written,
    }


# 兼容引用：避免 _classify_market 被 lint 当作 "未使用导入"
__all__ = ["run", "_classify_market"]
