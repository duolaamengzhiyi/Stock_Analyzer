import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { authUsers } from "./_auth";

/**
 * 站内账号名 + 个人资料；与 auth.users 1:1。
 * 邮箱权威来源在 auth.users，不在此表落库。
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    /** 已小写规范化，正则 ^[a-z0-9_-]{3,20}$（FR-008） */
    username: varchar("username", { length: 20 }).notNull().unique(),
    /** 用户原始输入（保留大小写），仅展示 */
    usernameDisplay: varchar("username_display", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({
    usernameIdx: uniqueIndex("profiles_username_idx").on(t.username),
  }),
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
