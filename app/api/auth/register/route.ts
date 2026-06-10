/**
 * POST /api/auth/register（FR-002 / FR-003 / FR-008 / FR-009）。
 *
 * 流程：
 *   1. Zod 校验 inviteCode / email / username / password
 *   2. service_role 查 invite_codes（FR-002 严格等于 violet-everGarden）
 *   3. service_role 提前查 profiles 是否已有同 username（FR-008）
 *   4. signUp({ email, password, options: { emailRedirectTo } })
 *   5. service_role 在 profiles 插入 { user_id, username (lower), username_display (raw) }
 *      - 若 profiles 唯一冲突，返回 409 USERNAME_TAKEN
 *      - 若插入失败但 auth user 已存在 → 不主动删 user，提示用户重试
 *   6. 写 audit_logs(kind='register', status='success')
 *   7. 响应 201 + FR-009 提示"请前往邮箱完成确认"
 */
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { signUpEmail, normalizeEmail } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  INVITE_CODE,
  registerInputSchema,
} from "@/lib/utils/zod-schemas";

import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function badRequest(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  status: "success" | "failed",
  subject: string | null,
  errorDetail?: string,
  meta?: Record<string, unknown>,
) {
  await admin.from("audit_logs").insert({
    kind: "register",
    status,
    subject,
    error_detail: errorDetail ?? null,
    meta: meta ?? null,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "请求体非合法 JSON");
  }

  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0]?.toString();
    const codeMap: Record<string, string> = {
      inviteCode: "INVALID_INVITE_CODE",
      email: "INVALID_EMAIL",
      username: "INVALID_USERNAME",
      password: "WEAK_PASSWORD",
    };
    return badRequest(codeMap[field ?? ""] ?? "INVALID_INPUT", issue.message);
  }

  const { inviteCode, email, password, username } = parsed.data;
  const emailNorm = normalizeEmail(email);
  const usernameNorm = username.trim().toLowerCase();
  const usernameDisplay = username.trim();

  const admin = createAdminClient();

  // FR-002 邀请码严格比较（已由 zod 校验，这里再 defense-in-depth 一次）
  if (inviteCode !== INVITE_CODE) {
    await writeAudit(admin, "failed", emailNorm, "invalid invite code");
    return badRequest("INVALID_INVITE_CODE", "邀请码错误");
  }

  // FR-008 提前查 username 唯一冲突，避免事后清理孤儿 auth user
  const existingByUsername = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, usernameNorm))
    .limit(1);
  if (existingByUsername.length > 0) {
    await writeAudit(admin, "failed", emailNorm, "username taken", {
      username: usernameNorm,
    });
    return badRequest("USERNAME_TAKEN", "该账号名已被占用", 409);
  }

  // signUp：confirmation 关闭时立即返回 user + session；
  // 开启时返回 user 但 session 为 null
  const { data: signUpData, error: signUpError } = await signUpEmail(
    admin,
    emailNorm,
    password,
  );

  if (signUpError) {
    const msg = signUpError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      await writeAudit(admin, "failed", emailNorm, "email taken");
      return badRequest("EMAIL_TAKEN", "该邮箱已注册", 409);
    }
    await writeAudit(admin, "failed", emailNorm, signUpError.message);
    return badRequest("REGISTER_FAILED", "注册失败，请稍后重试", 500);
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    await writeAudit(admin, "failed", emailNorm, "signUp returned no user");
    return badRequest("REGISTER_FAILED", "注册失败，请稍后重试", 500);
  }

  // 在 profiles 写入账号名
  try {
    await db.insert(profiles).values({
      userId,
      username: usernameNorm,
      usernameDisplay,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await writeAudit(admin, "failed", emailNorm, `profiles insert: ${errMsg}`, {
      username: usernameNorm,
    });
    // 并发冲突场景（两个请求同名）→ 返回 409
    if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
      return badRequest("USERNAME_TAKEN", "该账号名已被占用", 409);
    }
    return badRequest("REGISTER_FAILED", "注册失败，请稍后重试", 500);
  }

  await writeAudit(admin, "success", emailNorm, undefined, {
    username: usernameNorm,
  });

  return NextResponse.json(
    {
      userId,
      email: emailNorm,
      username: usernameDisplay,
      confirmationRequired: true,
      message: "注册成功，请前往邮箱完成确认",
    },
    { status: 201 },
  );
}
