import {
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 5 市场交易日历（FR-120 + SC-052）。
 * 窗口：过去 180 天 + 未来 365 天。
 * market: 'CN_A' | 'US' | 'HK' | 'JP' | 'KR'
 */
export const marketCalendar = pgTable(
  "market_calendar",
  {
    market: varchar("market", { length: 8 }).notNull(),
    date: date("date").notNull(),
    isOpen: boolean("is_open").notNull(),
    /** 节假日名称（'元旦' / 'Christmas' 等） */
    memo: text("memo"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.market, t.date] }),
    dateIdx: index("mc_date_idx").on(t.date),
  }),
);

export type MarketCalendar = typeof marketCalendar.$inferSelect;
export type NewMarketCalendar = typeof marketCalendar.$inferInsert;
