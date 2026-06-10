/**
 * T062 [US1] AuthModal 组件单测：渲染 + 错误行内提示。
 *
 * 不模拟完整 Next.js Router；只挂载 form 部分（AuthForm 不导出，
 * 通过 AuthModalLauncher 自动开启场景验证）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// next/navigation 在测试环境用占位
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("login=1"),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// useAuth 用 hook mock；测试关注：渲染 + 调用注册接口 + 错误展示
const registerMock = vi.fn();
const loginMock = vi.fn();
let authError: string | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    register: registerMock,
    login: loginMock,
    user: null,
    sessionState: "unauthenticated",
    authError,
  }),
}));

import { AuthModalLauncher } from "@/app/(auth)/_modals/auth-modal";

beforeEach(() => {
  registerMock.mockReset();
  loginMock.mockReset();
  authError = null;
});

describe("AuthModal", () => {
  it("?login=1 自动打开，默认显示登录 Tab", () => {
    render(<AuthModalLauncher />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // 登录 / 注册 Tab 都在
    expect(screen.getByRole("tab", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "注册" })).toBeInTheDocument();
    // 默认登录 tab：邀请码字段不该出现
    expect(screen.queryByLabelText("邀请码")).not.toBeInTheDocument();
  });

  it("切到注册 Tab → 显示邀请码与账号名字段", () => {
    render(<AuthModalLauncher />);
    fireEvent.click(screen.getByRole("tab", { name: "注册" }));
    expect(screen.getByLabelText("邀请码")).toBeInTheDocument();
    expect(screen.getByLabelText("账号名")).toBeInTheDocument();
  });

  it("authError 文案以 role=alert 行内展示（FR-007 统一文案）", () => {
    authError = "邮箱或密码错误";
    render(<AuthModalLauncher />);
    expect(screen.getByRole("alert")).toHaveTextContent("邮箱或密码错误");
  });

  it("提交注册成功后展示 FR-009 邮箱确认提示", async () => {
    registerMock.mockResolvedValue({
      ok: true,
      data: {
        userId: "u1",
        email: "a@b.com",
        username: "Alice",
        confirmationRequired: true,
        message: "ok",
      },
    });
    render(<AuthModalLauncher />);
    fireEvent.click(screen.getByRole("tab", { name: "注册" }));

    fireEvent.change(screen.getByLabelText("邀请码"), {
      target: { value: "violet-everGarden" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText("账号名"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /创建账号/ }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/邮箱.*确认/);
    });
  });
});
