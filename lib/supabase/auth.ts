/**
 * 真实邮箱注册/登录的 Supabase Auth 包装（FR-002 / FR-009 / spec Assumptions）。
 *
 * 设计原则：
 * - 邮箱在所有入口前 trim + 小写规范化（与 Supabase Auth 内部行为一致，
 *   避免大小写造成的"已存在但登录失败"混淆）。
 * - 注册时 emailRedirectTo 指向 `<SITE_URL>/auth/callback`；
 *   即使 Supabase 项目当前关闭了 confirm email，这条配置无副作用，
 *   未来开启邮件确认时无需改代码。
 * - 该模块只做"认证侧"操作，业务表（profiles / long_lived_tokens / audit_logs）
 *   由 Route Handler 自行用 service_role admin client 写入。
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** 邮箱注册（FR-002）。account_name 由 Route Handler 单独写入 profiles。 */
export async function signUpEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  const normalized = normalizeEmail(email);
  return supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });
}

/** 邮箱密码登录（FR-007 统一错误文案由调用方处理）。 */
export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  const normalized = normalizeEmail(email);
  return supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });
}

export async function signOut(supabase: SupabaseClient) {
  return supabase.auth.signOut();
}

export async function getSession(supabase: SupabaseClient) {
  return supabase.auth.getSession();
}

/** 邮箱确认回跳：以 code 换 server-side session（FR-009）。 */
export async function exchangeCodeForSession(
  supabase: SupabaseClient,
  code: string,
) {
  return supabase.auth.exchangeCodeForSession(code);
}
