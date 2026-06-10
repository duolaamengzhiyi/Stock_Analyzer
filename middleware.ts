/**
 * 全局 middleware 入口（FR-005）。
 * 当前仅做 session 刷新与受保护路由拦截的「框架性」处理；
 * 真实业务逻辑（long_lived_token 自动续期、redirect 参数解析）在 US1 阶段补全。
 */
import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/dashboard", "/watchlist", "/news"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirect", pathname);
    url.searchParams.set("login", "1");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Middleware 跑在 Node.js Runtime（Vercel Fluid Compute），
  // 避免 @supabase/supabase-js 在 Edge Runtime 下 process.version 警告。
  runtime: "nodejs",
  matcher: [
    // 排除静态资源与图标
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
