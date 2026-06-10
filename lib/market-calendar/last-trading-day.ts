/**
 * 取指定市场最近的一个交易日（FR-122 休市数据回退）。
 * 用法：A 股休市日 Dashboard 各板块 last_trading_day fallback。
 */
import { and, eq, lte, desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { marketCalendar } from "@/lib/db/schema";

import type { Market } from "./is-trading-day";

/**
 * @param market 市场代号
 * @param onOrBefore 'YYYY-MM-DD'，默认按 Asia/Shanghai today
 * @returns 最近的交易日字符串 'YYYY-MM-DD'；若日历表覆盖不到返回 null
 */
export async function lastTradingDay(
  market: Market,
  onOrBefore: string,
): Promise<string | null> {
  const rows = await db
    .select({ date: marketCalendar.date })
    .from(marketCalendar)
    .where(
      and(
        eq(marketCalendar.market, market),
        eq(marketCalendar.isOpen, true),
        lte(marketCalendar.date, onOrBefore),
      ),
    )
    .orderBy(desc(marketCalendar.date))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0].date;
}
