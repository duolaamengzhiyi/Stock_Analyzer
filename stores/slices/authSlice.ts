/**
 * 认证状态 slice（FR-001 / FR-004 / FR-005 / FR-006 / FR-007 / FR-009）。
 *
 * 仅承担前端的 session 视图状态，真正的凭证（cookie / long-lived token）
 * 由服务端持有；这里只缓存 user 元数据 + UI 旗标。
 */
import type { StateCreator } from "zustand";

export interface AuthUser {
  userId: string;
  email: string;
  username: string;
  usernameDisplay: string;
}

export type SessionState =
  | "unknown" // 初次加载，尚未校验 session
  | "authenticated"
  | "unauthenticated"
  | "pending-email-confirm"; // 注册成功但邮箱未确认（FR-009）

export interface AuthSlice {
  user: AuthUser | null;
  sessionState: SessionState;
  /** 注册/登录最近一次错误的用户可读文案（FR-007 统一文案） */
  authError: string | null;
  /** 登录表单的"7 天免登录"勾选 */
  rememberMe: boolean;

  setAuth: (user: AuthUser | null) => void;
  setSessionState: (s: SessionState) => void;
  setAuthError: (msg: string | null) => void;
  setRememberMe: (v: boolean) => void;
  /** 一键重置为 unauthenticated（用于登出） */
  clearAuth: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set,
) => ({
  user: null,
  sessionState: "unknown",
  authError: null,
  rememberMe: false,

  setAuth: (user) =>
    set({
      user,
      sessionState: user ? "authenticated" : "unauthenticated",
      authError: null,
    }),
  setSessionState: (sessionState) => set({ sessionState }),
  setAuthError: (authError) => set({ authError }),
  setRememberMe: (rememberMe) => set({ rememberMe }),
  clearAuth: () =>
    set({ user: null, sessionState: "unauthenticated", authError: null }),
});
