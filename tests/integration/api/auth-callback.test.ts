/**
 * T062a [US1] GET /auth/callback 路由测试（FR-009 邮箱确认回跳）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const exchangeMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/lib/supabase/auth", () => ({
  exchangeCodeForSession: (_supabase: unknown, code: string) =>
    exchangeMock(code),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: {} })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
  }),
}));

import { GET } from "@/app/auth/callback/route";

function makeReq(search: string): NextRequest {
  return new NextRequest(new URL(`http://localhost/auth/callback${search}`));
}

beforeEach(() => {
  exchangeMock.mockReset();
  auditInsertMock.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("GET /auth/callback", () => {
  it("合法 code + next=/dashboard → 302 到 /dashboard", async () => {
    exchangeMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { email: "a@b.com" } },
      error: null,
    });
    const res = await GET(makeReq("?code=abc&next=/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });

  it("缺省 next → 默认 /dashboard", async () => {
    exchangeMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { email: "a@b.com" } },
      error: null,
    });
    const res = await GET(makeReq("?code=abc"));
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });

  it("缺失 code → 302 回 / + login=1 + error=INVALID_AUTH_CALLBACK", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("login=1");
    expect(loc).toContain("error=INVALID_AUTH_CALLBACK");
  });

  it("非法 next（外站/协议相对）→ 强制回 /dashboard", async () => {
    exchangeMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { email: "a@b.com" } },
      error: null,
    });
    const res = await GET(
      makeReq("?code=abc&next=//evil.com/steal"),
    );
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });

  it("exchange 失败 → 302 回首页 login=1", async () => {
    exchangeMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "code expired" },
    });
    const res = await GET(makeReq("?code=expired"));
    const loc = res.headers.get("location")!;
    expect(loc).toContain("login=1");
    expect(loc).toContain("error=INVALID_AUTH_CALLBACK");
  });
});
