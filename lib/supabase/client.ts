/**
 * 浏览器侧 Supabase 客户端（@supabase/ssr）。
 * 使用 anon key + RLS；session cookie 由 middleware 维护。
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置",
    );
  }
  return createBrowserClient(url, anonKey);
}
