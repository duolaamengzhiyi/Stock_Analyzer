/**
 * service_role 客户端（仅服务端 Route Handler / Server Action 使用）。
 * 绕过 RLS，承担 profiles 写入、邀请码校验、long_lived_tokens 管理、
 * audit_logs 写入等服务端职责。
 *
 * 严禁在浏览器代码导入此模块。
 */
import { createClient } from "@supabase/supabase-js";

import "server-only";

export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置");
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
