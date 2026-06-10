import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { profiles } from "./profiles";
import { stocks } from "./stocks";

/**
 * 用户自选股关系（FR-010 重复合并 / FR-011 拖拽排序）。
 * (userId, code) 唯一；orderIndex 由服务端事务批改。
 */
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    code: varchar("code", { length: 6 })
      .notNull()
      .references(() => stocks.code, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userCodeUnique: uniqueIndex("wi_user_code_idx").on(t.userId, t.code),
    userOrderIdx: index("wi_user_order_idx").on(t.userId, t.orderIndex),
  }),
);

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;
