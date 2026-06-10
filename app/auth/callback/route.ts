/**
 * GET /auth/callback（FR-009 邮箱确认回跳）。
 *
 * Supabase 会以 ?code=...&next=/dashboard 形式回跳；我们用 server client
 * exchangeCodeForSession 把 code 兑换成 server-side session（写 sb-* cookie），
 * 然后 302 到 next 指定路径（缺省 /dashboard）。
 *
 * 失败：302 回首页 + login=1（弹窗），并用 error 查询参数透传简短原因。
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForSession } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isSafeNext(value: string | null): value is string {
  if (!value) return false;
  // 只允许同源相对路径，避免开放重定向
  return value.startsWith("/") && !value.startsWith("//");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? url.searchParams.get("redirect");
  const next = isSafeNext(nextParam) ? nextParam! : "/dashboard";

  const admin = createAdminClient();

  if (!code) {
    await admin.from("audit_logs").insert({
      kind: "register",
      status: "failed",
      subject: null,
      error_detail: "auth-callback: missing code",
    });
    const back = url.clone();
    back.pathname = "/";
    back.search = "";
    back.searchParams.set("login", "1");
    back.searchParams.set("error", "INVALID_AUTH_CALLBACK");
    return NextResponse.redirect(back);
  }

  const supabase = await createClient();
  const { data, error } = await exchangeCodeForSession(supabase, code);

  if (error || !data.session) {
    await admin.from("audit_logs").insert({
      kind: "register",
      status: "failed",
      subject: null,
      error_detail: `auth-callback: ${error?.message ?? "no session"}`,
    });
    const back = url.clone();
    back.pathname = "/";
    back.search = "";
    back.searchParams.set("login", "1");
    back.searchParams.set("error", "INVALID_AUTH_CALLBACK");
    return NextResponse.redirect(back);
  }

  await admin.from("audit_logs").insert({
    kind: "register",
    status: "success",
    subject: data.user?.email ?? null,
    meta: { event: "email-confirmed" },
  });

  const target = url.clone();
  target.pathname = next;
  target.search = "";
  return NextResponse.redirect(target);
}
