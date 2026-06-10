import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * AI 生成产物 · 永久保留（FR-052 / FR-053 / FR-054 / FR-055 全部承载于此）。
 *
 * 写入规则：
 *   - 每次成功生成 INSERT 一条，永不 UPDATE。
 *   - 失败时不写新行，前端继续读到上一条 failed=false（FR-053 回退）。
 *   - 读取：取 (kind, primaryKey) 下 failed=false 且 generatedAt 最新一条。
 */
export const aiArtifacts = pgTable(
  "ai_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * 'midday' | 'evening' | 'forecast' | 'news-summary' |
     * 'stock-intro' | 'stock-analysis' | 'sector-picks-batch'
     */
    kind: varchar("kind", { length: 24 }).notNull(),
    /**
     * - midday/evening/forecast：交易日 'YYYY-MM-DD'
     * - news-summary：批次 ISO 时间
     * - stock-intro/stock-analysis：股票代码
     * - sector-picks-batch：交易日
     */
    primaryKey: varchar("primary_key", { length: 32 }).notNull(),
    content: text("content").notNull(),
    /** AI 产物生成时间（FR-054 双时间戳之一） */
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** 参考数据时间（FR-054 双时间戳之二） */
    sourceDataAt: timestamp("source_data_at", { withTimezone: true }).notNull(),
    /** 上下文 SHA-256，便于排查 */
    upstreamHash: varchar("upstream_hash", { length: 64 }),
    model: varchar("model", { length: 40 }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    /** 失败版本标记；前端读取时 failed=false 才使用 */
    failed: boolean("failed").notNull().default(false),
  },
  (t) => ({
    kindKeyIdx: index("ai_kind_key_idx").on(
      t.kind,
      t.primaryKey,
      sql`${t.generatedAt} DESC`,
    ),
    kindDateIdx: index("ai_kind_sourcedate_idx").on(
      t.kind,
      sql`${t.sourceDataAt} DESC`,
    ),
  }),
);

export type AiArtifact = typeof aiArtifacts.$inferSelect;
export type NewAiArtifact = typeof aiArtifacts.$inferInsert;
