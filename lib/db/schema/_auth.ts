/**
 * 引用 Supabase 自带的 `auth.users` 表用于 FK 关联。
 *
 * 该表由 Supabase 平台维护，drizzle-kit generate 不应该派生 DDL；
 * 仅作为外键 references 目标暴露。
 */
import { pgSchema, uuid } from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
