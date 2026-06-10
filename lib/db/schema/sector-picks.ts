import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { stocks } from "./stocks";

/**
 * 预测推荐板块条目（≤ 5/天，FR-070 / FR-072）。
 * 与 ai_artifacts(kind=forecast) 通过 trade_date 逻辑关联。
 */
export const sectorPicks = pgTable(
  "sector_picks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeDate: date("trade_date").notNull(),
    /** 1..5，超过 5 视为越界 */
    rank: integer("rank").notNull(),
    /** 东方财富概念板块代号，如 'BK0855' */
    conceptBoardCode: varchar("concept_board_code", { length: 16 }).notNull(),
    /** '虚拟现实' 等 */
    conceptBoardName: varchar("concept_board_name", { length: 32 }).notNull(),
    leaderCode: varchar("leader_code", { length: 6 }).references(
      () => stocks.code,
    ),
    leaderName: varchar("leader_name", { length: 32 }),
    rationaleShort: text("rationale_short"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: uniqueIndex("sp_date_rank_idx").on(t.tradeDate, t.rank),
    dateIdx: index("sp_date_idx").on(sql`${t.tradeDate} DESC`),
  }),
);

export type SectorPick = typeof sectorPicks.$inferSelect;
export type NewSectorPick = typeof sectorPicks.$inferInsert;
