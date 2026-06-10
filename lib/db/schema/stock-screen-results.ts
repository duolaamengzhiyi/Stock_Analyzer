import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { stocks } from "./stocks";

/**
 * 筛选结果快照：launching-soon / main-uptrend，每对 (date,kind) ≤ 20 条（FR-042）。
 * 写入在单事务里 DELETE+INSERT 当日该 kind 全部记录，保证原子性。
 */
export const stockScreenResults = pgTable(
  "stock_screen_results",
  {
    tradeDate: date("trade_date").notNull(),
    /** 'launching-soon' | 'main-uptrend' */
    kind: varchar("kind", { length: 24 }).notNull(),
    code: varchar("code", { length: 6 })
      .notNull()
      .references(() => stocks.code),
    rank: integer("rank").notNull(),
    /** 当日涨跌幅（展示用，不参与筛选） */
    snapshotChangePct: numeric("snapshot_change_pct", {
      precision: 8,
      scale: 4,
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** 算法中间量（振幅、回归斜率等），便于排查 */
    debugMeta: jsonb("debug_meta"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tradeDate, t.kind, t.code] }),
    dateKindIdx: index("ssr_date_kind_idx").on(t.tradeDate, t.kind, t.rank),
  }),
);

export type StockScreenResult = typeof stockScreenResults.$inferSelect;
export type NewStockScreenResult = typeof stockScreenResults.$inferInsert;
