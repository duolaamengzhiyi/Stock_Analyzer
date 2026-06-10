"""Realtime 广播工具：调用 Supabase realtime.send 发送事件。

与 contracts/realtime-events.md 对齐：
  - channel = 'data-updated'
  - payload = { kind, sourceDataAt, generatedAt, tradeDate?, affectedBoards, meta? }

Vercel 客户端通过 useRealtimeChannel 订阅同名 channel 后做局部 invalidate。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sealos.scheduler.audit import write_audit
from sealos.scheduler.clients.supabase import get_supabase_client

CHANNEL = "data-updated"

# 与 lib/realtime/channels.ts EventKind 一一对应
EVENT_KIND_VALUES = {
    "stock-daily-midday",
    "stock-daily-close",
    "news-fetch-done",
    "news-summary-done",
    "ai-midday-done",
    "ai-evening-done",
    "ai-forecast-done",
    "sector-picks-done",
    "calendar-refresh-done",
    "manual-refresh-done",
}


def _to_iso(value: datetime | str | None) -> str:
    """统一把 datetime / 字符串 / None 转成 ISO8601。None 取当前 UTC。"""
    if value is None:
        return datetime.now(tz=timezone.utc).isoformat()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return value


def publish_event(
    *,
    kind: str,
    affected_boards: list[str],
    source_data_at: datetime | str | None = None,
    generated_at: datetime | str | None = None,
    trade_date: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """广播一条 Realtime 事件。出错只写审计，不向上抛（避免阻塞 job）。

    payload 字段命名遵循 contracts/realtime-events.md：camelCase。
    """
    if kind not in EVENT_KIND_VALUES:
        raise ValueError(f"未知 EventKind: {kind!r}")

    payload: dict[str, Any] = {
        "kind": kind,
        "sourceDataAt": _to_iso(source_data_at),
        "generatedAt": _to_iso(generated_at),
        "affectedBoards": affected_boards,
    }
    if trade_date is not None:
        payload["tradeDate"] = trade_date
    if meta is not None:
        payload["meta"] = meta

    try:
        client = get_supabase_client()
        client.realtime.send_broadcast(CHANNEL, kind, payload)  # type: ignore[attr-defined]
    except Exception as e:  # noqa: BLE001
        write_audit(
            kind="realtime-publish",
            status="failed",
            subject=kind,
            error_detail=str(e),
            meta={"affectedBoards": affected_boards},
        )
        return

    write_audit(
        kind="realtime-publish",
        status="success",
        subject=kind,
        meta={"affectedBoards": affected_boards},
    )
