/**
 * GET /api/dashboard/data-status
 *
 * 返回 Sealos Scheduler 最近一次成功 stock-fetch 任务的时间戳，
 * 用于 Dashboard 顶部"数据截止至 …"提示（FR-023）。
 *
 * 数据源：audit_logs (kind='stock-fetch', status='success')。
 * 不要求认证：是公共数据状态摘要，无敏感字段。
 */

import { NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/audit-logs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select({
        subject: auditLogs.subject,
        occurredAt: auditLogs.occurredAt,
        meta: auditLogs.meta,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.kind, "stock-fetch"), eq(auditLogs.status, "success")))
      .orderBy(desc(auditLogs.occurredAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          status: "no-data",
          lastSuccess: null,
          subject: null,
          tradeDate: null,
        },
        { status: 200 },
      );
    }

    const row = rows[0];
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      status: "ok",
      lastSuccess: row.occurredAt,
      subject: row.subject,
      tradeDate: typeof meta.trade_date === "string" ? meta.trade_date : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }
}
