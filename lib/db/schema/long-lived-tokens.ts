import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

/**
 * 7 天免登录长期凭证（FR-004 / FR-006）。
 * - token_hash = SHA-256(raw token)，DB 不留 raw
 * - HttpOnly + Secure + SameSite=Lax cookie 仅承载 raw token
 */
export const longLivedTokens = pgTable(
  "long_lived_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
  },
  (t) => ({
    userIdx: index("llt_user_idx").on(t.userId),
    hashIdx: uniqueIndex("llt_hash_idx").on(t.tokenHash),
    expIdx: index("llt_exp_idx").on(t.expiresAt),
  }),
);

export type LongLivedToken = typeof longLivedTokens.$inferSelect;
export type NewLongLivedToken = typeof longLivedTokens.$inferInsert;
