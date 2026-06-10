import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 任务审计 · 永久保留。
 * RLS 全关，service_role only。
 * kind 取值：
 *   'stock-fetch' | 'news-fetch' | 'ai-generate' | 'cleanup' |
 *   'initial-backfill' | 'login-failure' | 'login-success' |
 *   'register' | 'manual-refresh' | 'calendar-refresh' |
 *   'sector-picks' | 'realtime-publish'
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: varchar("kind", { length: 32 }).notNull(),
    /** 'success' | 'skipped' | 'failed' */
    status: varchar("status", { length: 16 }).notNull(),
    /** 事件目标：kind / username / code 等 */
    subject: varchar("subject", { length: 64 }),
    meta: jsonb("meta"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    errorDetail: text("error_detail"),
  },
  (t) => ({
    kindIdx: index("al_kind_idx").on(t.kind, sql`${t.occurredAt} DESC`),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
