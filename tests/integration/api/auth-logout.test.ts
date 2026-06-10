/**
 * T059 [US1] POST /api/auth/logout 端点契约测试（FR-006 双凭证失效）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const signOutMock = vi.fn();
const revokeMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const getUserMock = vi.fn();

vi.mock("@/lib/auth/long-lived-token", () => ({
  LLT_COOKIE_NAME: "llt_token",
  revokeLongLivedTokenByRaw: (raw: string) => revokeMock(raw),
}));

vi.mock("@/lib/supabase/auth", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: () => getUserMock(),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
  }),
}));

import { POST } from "@/app/api/auth/logout/route";

beforeEach(() => {
  signOutMock.mockReset().mockResolvedValue({ error: null });
  revokeMock.mockReset().mockResolvedValue(undefined);
  auditInsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  getUserMock.mockReset().mockResolvedValue({
    data: { user: { email: "a@b.com" } },
  });
});

describe("POST /api/auth/logout", () => {
  it("无 LLT cookie → 调 signOut + 写审计 + 204 + 清 llt_token cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );
    expect(res.status).toBe(204);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(revokeMock).not.toHaveBeenCalled();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("llt_token=");
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("有 LLT cookie → 同步吊销（FR-006）", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: "llt_token=raw123; sb-access-token=xxx",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(revokeMock).toHaveBeenCalledWith("raw123");
  });
});
