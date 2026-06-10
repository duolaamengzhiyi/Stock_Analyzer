/**
 * T060 [US1] middleware 拦截单测：未登录访问 /dashboard / /watchlist / /news
 * → 302 回首页并附 redirect 与 login=1。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));
vi.mock("@/lib/auth/long-lived-token", () => ({
  LLT_COOKIE_NAME: "llt_token",
  verifyAndSlideLongLivedToken: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { generateLink: vi.fn() } },
  })),
}));

import { middleware } from "@/middleware";
import { updateSession } from "@/lib/supabase/middleware";

function makeReq(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

beforeEach(() => {
  vi.mocked(updateSession).mockReset();
});

describe("middleware 受保护路由", () => {
  it.each(["/dashboard", "/watchlist", "/news"])(
    "未登录访问 %s → 302 回 / 并带 redirect+login=1",
    async (path) => {
      vi.mocked(updateSession).mockResolvedValue({
        response: new Response(null, { status: 200 }) as unknown as ReturnType<typeof updateSession> extends Promise<infer R> ? R extends { response: infer X } ? X : never : never,
        user: null,
      } as never);

      const req = makeReq(path);
      const res = await middleware(req);
      expect(res.status).toBe(307);
      const loc = res.headers.get("location")!;
      expect(loc).toContain("/?");
      expect(loc).toContain(`redirect=${encodeURIComponent(path)}`);
      expect(loc).toContain("login=1");
    },
  );

  it("已登录访问 /dashboard → 透传 response（不重定向）", async () => {
    const passThrough = new Response(null, { status: 200, headers: { "x-test": "passed" } });
    vi.mocked(updateSession).mockResolvedValue({
      response: passThrough as never,
      user: { id: "u1" } as never,
    });

    const res = await middleware(makeReq("/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-test")).toBe("passed");
  });

  it("公开路径（/）放行，无论登录与否", async () => {
    const passThrough = new Response(null, { status: 200 });
    vi.mocked(updateSession).mockResolvedValue({
      response: passThrough as never,
      user: null,
    });

    const res = await middleware(makeReq("/"));
    expect(res.status).toBe(200);
  });
});
