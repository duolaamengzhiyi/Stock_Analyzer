import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 邀请码配置；本期单条种子 ('violet-everGarden', reusable=true)。
 * RLS 全关，仅 service_role 可读。
 */
export const inviteCodes = pgTable("invite_codes", {
  code: varchar("code", { length: 64 }).primaryKey(),
  reusable: boolean("reusable").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  description: text("description"),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
