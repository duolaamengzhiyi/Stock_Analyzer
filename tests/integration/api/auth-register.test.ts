/**
 * T057 [US1] POST /api/auth/register 端点契约测试。
 *
 * 覆盖：
 *  - 邀请码错误 → 400 INVALID_INVITE_CODE
 *  - 邮箱格式非法 → 400 INVALID_EMAIL
 *  - 账号名正则不合法 → 400 INVALID_USERNAME
 *  - 密码过短 → 400 WEAK_PASSWORD
 *  - 重复邮箱 → 409 EMAIL_TAKEN
 *  - 重复账号名 → 409 USERNAME_TAKEN
 *  - 注册并发互斥（profiles 唯一冲突）→ 409 USERNAME_TAKEN
 *  - 成功 → 201 + confirmationRequired:true + 提示文案 (FR-009)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertProfilesMock = vi.fn();
const selectProfilesMock = vi.fn();
const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const signUpMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn((table) => ({
      values: vi.fn(async (vals) => insertProfilesMock(table, vals)),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectProfilesMock()),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  profiles: { _: "profiles_table" },
}));

vi.mock("@/lib/supabase/auth", async () => ({
  signUpEmail: (...args: unknown[]) => signUpMock(...args),
  normalizeEmail: (s: string) => s.trim().toLowerCase(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
    auth: {},
  }),
}));

import { POST } from "@/app/api/auth/register/route";

function req(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insertProfilesMock.mockReset().mockResolvedValue(undefined);
  selectProfilesMock.mockReset().mockResolvedValue([]);
  auditInsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  signUpMock.mockReset();
});

describe("POST /api/auth/register", () => {
  it("邀请码错误 → 400 INVALID_INVITE_CODE", async () => {
    const res = await POST(
      req({
        inviteCode: "wrong",
        email: "a@b.com",
        username: "alice",
        password: "password123",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_INVITE_CODE");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("邮箱格式非法 → 400 INVALID_EMAIL", async () => {
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "not-email",
        username: "alice",
        password: "password123",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_EMAIL");
  });

  it("账号名不合法 → 400 INVALID_USERNAME", async () => {
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "a@b.com",
        username: "中文名", // 不符合 ^[A-Za-z0-9_-]{3,20}$
        password: "password123",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_USERNAME");
  });

  it("密码过短 → 400 WEAK_PASSWORD", async () => {
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "a@b.com",
        username: "alice",
        password: "short",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("WEAK_PASSWORD");
  });

  it("重复账号名 → 409 USERNAME_TAKEN（前置查命中）", async () => {
    selectProfilesMock.mockResolvedValueOnce([{ userId: "existing" }]);
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "new@b.com",
        username: "alice",
        password: "password123",
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("USERNAME_TAKEN");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("Supabase signUp 报 already registered → 409 EMAIL_TAKEN", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "dup@b.com",
        username: "newuser",
        password: "password123",
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it("注册并发：profiles 插入抛 unique 冲突 → 409 USERNAME_TAKEN", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u-new" } },
      error: null,
    });
    insertProfilesMock.mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint"),
    );
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "race@b.com",
        username: "racer",
        password: "password123",
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("USERNAME_TAKEN");
  });

  it("成功 → 201 + confirmationRequired + FR-009 提示文案", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u-ok" } },
      error: null,
    });
    const res = await POST(
      req({
        inviteCode: "violet-everGarden",
        email: "OK@B.Com  ",
        username: "Bob",
        password: "password123",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("u-ok");
    expect(body.email).toBe("ok@b.com"); // trim + lowercase
    expect(body.username).toBe("Bob"); // display 保留原写
    expect(body.confirmationRequired).toBe(true);
    expect(body.message).toMatch(/邮箱.*确认/);
  });
});
