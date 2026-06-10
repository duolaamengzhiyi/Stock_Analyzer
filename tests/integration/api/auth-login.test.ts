/**
 * T058 [US1] POST /api/auth/login 端点契约测试。
 *
 * 覆盖：
 *  - 邮箱+密码登录成功 → 200 + 用户 username
 *  - 错误统一文案 INVALID_CREDENTIALS（FR-007）
 *  - 邮箱未确认 → 403 EMAIL_NOT_CONFIRMED（FR-009）
 *  - rememberMe=true → set-cookie 含 llt_token
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const issueLLTMock = vi.fn();

vi.mock("@/lib/db", () => {
  const exec = vi.fn(async () => undefined);
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () =>
              [{ username: "alice", usernameDisplay: "Alice" }] as unknown,
            ),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: exec,
        })),
      })),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  profiles: { _: "profiles_table" },
}));

vi.mock("@/lib/auth/long-lived-token", () => ({
  LLT_COOKIE_NAME: "llt_token",
  LLT_TTL_SECONDS: 7 * 24 * 60 * 60,
  issueLongLivedToken: (...args: unknown[]) => issueLLTMock(...args),
}));

vi.mock("@/lib/supabase/auth", () => ({
  signInWithEmail: (...args: unknown[]) => signInMock(...args),
  normalizeEmail: (s: string) => s.trim().toLowerCase(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {},
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
    auth: {},
  }),
}));

import { POST } from "@/app/api/auth/login/route";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  signInMock.mockReset();
  auditInsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  issueLLTMock.mockReset().mockResolvedValue({
    raw: "raw-llt-token",
    expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
  });
});

describe("POST /api/auth/login", () => {
  it("成功登录 → 200 + username", async () => {
    signInMock.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const res = await POST(
      req({ email: "a@b.com", password: "password123" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("u1");
    expect(body.username).toBe("Alice");
  });

  it("密码错误 → 401 INVALID_CREDENTIALS（FR-007 统一文案）", async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const res = await POST(
      req({ email: "a@b.com", password: "wrongpass1" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
    expect(body.error.message).toBe("邮箱或密码错误");
  });

  it("非法输入 → 401 INVALID_CREDENTIALS（不暴露字段问题，防枚举）", async () => {
    const res = await POST(req({ email: "not-email", password: "x" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("邮箱未确认 → 403 EMAIL_NOT_CONFIRMED（FR-009）", async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });
    const res = await POST(
      req({ email: "a@b.com", password: "password123" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("rememberMe=true → set-cookie 含 llt_token", async () => {
    signInMock.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const res = await POST(
      req({
        email: "a@b.com",
        password: "password123",
        rememberMe: true,
      }),
    );
    expect(res.status).toBe(200);
    expect(issueLLTMock).toHaveBeenCalledTimes(1);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("llt_token=raw-llt-token");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });
});
