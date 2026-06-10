import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 资讯条目 · 7 日滚动（FR-031）。
 * cleanup job 删 published_at < now() - INTERVAL '7 days'。
 * 被 AI 引用过的总结保存在 ai_artifacts，不受清理影响。
 */
export const newsItems = pgTable(
  "news_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 'CLS' | 'CCTV' | ... */
    source: varchar("source", { length: 16 }).notNull(),
    /** 上游原始 id（去重用） */
    externalId: varchar("external_id", { length: 64 }),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sourceExtIdx: uniqueIndex("ni_source_ext_idx").on(t.source, t.externalId),
    publishedIdx: index("ni_published_idx").on(sql`${t.publishedAt} DESC`),
  }),
);

export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
