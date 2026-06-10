/**
 * POST /api/auth/logout（FR-006 双凭证同步失效）。
 *
 * 流程：
 *   1. supabase.auth.signOut() 让短期 session 失效
 *   2. 若 cookie 含 llt_token，service_role 标记 long_lived_tokens.revoked_at = now
 *   3. 清除 cookie（sb-* 由 supabase 自行处理；llt_token 我们清）
 *   4. 写 audit_logs(kind='login-success' 不适用；这里无独立 kind，用 manual-refresh 不合适）
 *      → 用 'register' 之外另一个常量是不必要的；按 schema audit_logs.kind 注释列了
 *      'login-success' 是登录成功；登出本身按 contracts/sealos-jobs.md 没强制要求审计，
 *      但为了 SC-031 验收完整，这里写一条 kind='login-success' status='skipped'
 *      不合适。综合：直接复用 audit_logs，kind='login-success' status='skipped' 不对，
 *      这里使用 kind='register' 不可。考虑可读性使用新常量 'logout' 写入。
 */
import { NextResponse } from "next/server";

import { LLT_COOKIE_NAME, revokeLongLivedTokenByRaw } from "@/lib/auth/long-lived-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 当前 user（用作审计 subject；signOut 后取不到）
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const subject = user?.email ?? null;

  // 让短期 session 失效；同时 server client 会清 sb-* cookie
  await signOut(supabase);

  // 吊销 LLT（FR-006）
  const llt = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${LLT_COOKIE_NAME}=`))
    ?.slice(LLT_COOKIE_NAME.length + 1);
  if (llt) {
    try {
      await revokeLongLivedTokenByRaw(decodeURIComponent(llt));
    } catch {
      // 即便 LLT 吊销失败，也不阻塞登出
    }
  }

  await admin.from("audit_logs").insert({
    kind: "logout",
    status: "success",
    subject,
  });

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(LLT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
