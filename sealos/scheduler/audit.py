"""audit_logs 写入工具。

所有 job 完成后调 write_audit('xxx', status='success'/'failed'/'skipped', ...)；
RLS 全关，仅 service_role 写入（service_role 客户端从 clients.supabase 拿）。
"""

from __future__ import annotations

import json
from typing import Any

from sealos.scheduler.clients.supabase import get_supabase_client


def write_audit(
    *,
    kind: str,
    status: str,
    subject: str | None = None,
    meta: dict[str, Any] | None = None,
    error_detail: str | None = None,
) -> None:
    """单条审计日志。出错时 print 到 stderr（避免递归）。"""
    row: dict[str, Any] = {
        "kind": kind,
        "status": status,
    }
    if subject is not None:
        row["subject"] = subject
    if meta is not None:
        row["meta"] = meta
    if error_detail is not None:
        row["error_detail"] = error_detail

    try:
        client = get_supabase_client()
        client.table("audit_logs").insert(row).execute()
    except Exception as e:  # noqa: BLE001
        # 用 print 避免在 logger 层级再次循环依赖
        print(
            "[audit_logs WRITE FAILED]",
            json.dumps(row, ensure_ascii=False),
            "→",
            e,
            flush=True,
        )
