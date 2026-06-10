/**
 * Drizzle DB client（Vercel 侧、Node runtime）。
 * 使用 postgres-js 直连 Supabase Postgres，凭证来自 POSTGRES_URL。
 *
 * 注意：仅在 Server Component / Route Handler / 服务端代码中导入；
 * 浏览器端必须通过 @/lib/supabase/client 走 PostgREST + RLS。
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL 未配置；请检查 .env.local");
}

// pooler 连接：prepare=false 是 Supabase Transaction Pooler 的硬要求
const client = postgres(connectionString, {
  prepare: false,
  // Vercel Function 实例的并发是 Fluid Compute 默认值；max=1 避免 pooler 上层叠加
  max: 1,
});

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Database = typeof db;
export { schema };
