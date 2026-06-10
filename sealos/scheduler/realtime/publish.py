"""Realtime 广播工具：调用 Supabase realtime.send 发送事件。

与 contracts/realtime-events.md 对齐：
  - channel = 'data-updated'
  - payload = { kind, affected_boards, occurred_at, meta? }

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


def publish_event(
    *,
    kind: str,
    affected_boards: list[str],
    meta: dict[str, Any] | None = None,
) -> None:
    """广播一条 Realtime 事件。出错只写审计，不向上抛（避免阻塞 job）。"""
    if kind not in EVENT_KIND_VALUES:
        raise ValueError(f"未知 EventKind: {kind!r}")

    payload = {
        "kind": kind,
        "affectedBoards": affected_boards,
        "occurredAt": datetime.now(tz=timezone.utc).isoformat(),
    }
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
