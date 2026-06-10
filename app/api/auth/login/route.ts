/**
 * POST /api/auth/login（FR-004 / FR-007 / FR-009）。
 *
 * 流程：
 *   1. Zod 校验 email + password + rememberMe（默认 false）
 *   2. signInWithPassword
 *      - 邮箱未确认：返回 EMAIL_NOT_CONFIRMED
 *      - 其它失败：统一文案 INVALID_CREDENTIALS（FR-007）+ audit_logs 失败
 *   3. 成功：
 *      - service_role 拿 profiles 拼 username
 *      - 更新 profiles.last_login_at
 *      - 若 rememberMe → issueLongLivedToken + 写 cookie llt_token
 *      - audit_logs(kind='login-success')
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { issueLongLivedToken, LLT_COOKIE_NAME, LLT_TTL_SECONDS } from "@/lib/auth/long-lived-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { signInWithEmail, normalizeEmail } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { loginInputSchema } from "@/lib/utils/zod-schemas";

export const runtime = "nodejs";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  status: "success" | "failed",
  subject: string | null,
  errorDetail?: string,
) {
  await admin.from("audit_logs").insert({
    kind: status === "success" ? "login-success" : "login-failure",
    status: status === "success" ? "success" : "failed",
    subject,
    error_detail: errorDetail ?? null,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "请求体非合法 JSON", 400);
  }

  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "INVALID_CREDENTIALS",
      "邮箱或密码错误",
      401,
    );
  }
  const { email, password, rememberMe } = parsed.data;
  const emailNorm = normalizeEmail(email);

  const admin = createAdminClient();
  // 用 server client 完成登录，使其向 cookie 写入 sb-access-token / sb-refresh-token
  const supabase = await createClient();

  const { data, error } = await signInWithEmail(supabase, emailNorm, password);

  if (error) {
    const msg = error.message.toLowerCase();
    // FR-009：邮箱未确认特化文案
    if (
      msg.includes("not confirmed") ||
      msg.includes("email_not_confirmed") ||
      msg.includes("confirmation")
    ) {
      await writeAudit(admin, "failed", emailNorm, "email not confirmed");
      return jsonError(
        "EMAIL_NOT_CONFIRMED",
        "请先完成邮箱确认后再登录",
        403,
      );
    }
    await writeAudit(admin, "failed", emailNorm, error.message);
    // FR-007 统一文案
    return jsonError("INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  const userId = data.user?.id;
  if (!userId) {
    await writeAudit(admin, "failed", emailNorm, "signIn returned no user");
    return jsonError("INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  // 拉 profile（用 service_role 绕过 RLS，避免依赖刚写入的 cookie）
  const profileRows = await db
    .select({
      username: profiles.username,
      usernameDisplay: profiles.usernameDisplay,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) {
    // 极少见：auth.users 存在但 profiles 没插入。回滚式提示。
    await writeAudit(admin, "failed", emailNorm, "profile missing");
    return jsonError("INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  // 更新 last_login_at
  await db
    .update(profiles)
    .set({ lastLoginAt: new Date() })
    .where(eq(profiles.userId, userId));

  await writeAudit(admin, "success", emailNorm);

  const response = NextResponse.json(
    {
      userId,
      email: emailNorm,
      username: profileRows[0].usernameDisplay,
    },
    { status: 200 },
  );

  // FR-004 7 天免登录
  if (rememberMe) {
    const headers = request.headers;
    const userAgent = headers.get("user-agent");
    const xff = headers.get("x-forwarded-for");
    const ip = xff?.split(",")[0]?.trim() ?? null;

    const { raw } = await issueLongLivedToken({
      userId,
      userAgent,
      ip,
    });
    response.cookies.set(LLT_COOKIE_NAME, raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: LLT_TTL_SECONDS,
    });
  }

  return response;
}
