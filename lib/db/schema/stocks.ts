import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 股票元数据：5500 条左右，永久保留（可软删）。
 * market: MAIN(主板) | STAR(科创) | GEM(创业) | BJ(北交所)
 * 筛选仅允许 MAIN+STAR（FR-040c / FR-041c）
 */
export const stocks = pgTable(
  "stocks",
  {
    code: varchar("code", { length: 6 }).primaryKey(),
    name: varchar("name", { length: 32 }).notNull(),
    market: varchar("market", { length: 8 }).notNull(),
    isSt: boolean("is_st").notNull().default(false),
    delisted: boolean("delisted").notNull().default(false),
    industryL1: varchar("industry_l1", { length: 32 }),
    /** 命中的概念板块名列表，用于个股 AI 介绍上下文 */
    concepts: text("concepts").array(),
    /** 总市值，元 */
    latestMarketCap: numeric("latest_market_cap", {
      precision: 20,
      scale: 2,
    }),
    latestSnapshotAt: timestamp("latest_snapshot_at", { withTimezone: true }),
  },
  (t) => ({
    marketIdx: index("stocks_market_idx").on(t.market),
    nameIdx: index("stocks_name_idx").on(t.name),
  }),
);

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;
