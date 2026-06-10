/**
 * 判断指定日期是否为给定市场的交易日（FR-120 + SC-052）。
 * 数据来源：market_calendar 表（5 市场）。
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { marketCalendar } from "@/lib/db/schema";

export type Market = "CN_A" | "US" | "HK" | "JP" | "KR";

/**
 * @param market 市场代号
 * @param date 'YYYY-MM-DD'（Asia/Shanghai 自然日）
 * @returns true=交易日，false=休市，null=日历表无该日（应触发 calendar_refresh 兜底）
 */
export async function isTradingDay(
  market: Market,
  date: string,
): Promise<boolean | null> {
  const rows = await db
    .select({ isOpen: marketCalendar.isOpen })
    .from(marketCalendar)
    .where(
      and(eq(marketCalendar.market, market), eq(marketCalendar.date, date)),
    )
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0].isOpen;
}
