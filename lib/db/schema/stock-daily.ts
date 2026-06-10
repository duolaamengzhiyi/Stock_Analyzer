import {
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { stocks } from "./stocks";

/**
 * 日行情 · 60 个 A 股交易日滚动（FR-022）。
 * 主键 (code, trade_date)；规模约 5500 × 60 ≈ 33 万行。
 */
export const stockDaily = pgTable(
  "stock_daily",
  {
    code: varchar("code", { length: 6 })
      .notNull()
      .references(() => stocks.code, { onDelete: "cascade" }),
    tradeDate: date("trade_date").notNull(),
    open: numeric("open", { precision: 12, scale: 4 }),
    high: numeric("high", { precision: 12, scale: 4 }),
    low: numeric("low", { precision: 12, scale: 4 }),
    close: numeric("close", { precision: 12, scale: 4 }).notNull(),
    volume: numeric("volume", { precision: 20, scale: 0 }).notNull(),
    turnover: numeric("turnover", { precision: 20, scale: 2 }),
    /** 当日涨跌幅 % */
    changePct: numeric("change_pct", { precision: 8, scale: 4 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.code, t.tradeDate] }),
    dateIdx: index("stock_daily_date_idx").on(t.tradeDate),
    dateCodeIdx: index("stock_daily_date_code_idx").on(t.tradeDate, t.code),
  }),
);

export type StockDaily = typeof stockDaily.$inferSelect;
export type NewStockDaily = typeof stockDaily.$inferInsert;
