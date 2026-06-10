/**
 * useAuth：注册 / 登录 / 登出 + 当前 session 读取的统一前端入口。
 *
 * 仅与本仓库的 /api/auth/* Route Handler 对接；不直接调 Supabase 浏览器 SDK，
 * 让"业务校验 + 写库 + 审计"集中在服务端。
 */
"use client";

import { useCallback } from "react";

import { useAppStore } from "@/stores/useAppStore";

interface RegisterPayload {
  inviteCode: string;
  email: string;
  username: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface ApiError {
  code: string;
  message: string;
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiError }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 204) return { ok: true, data: undefined as T };
  const json = (await res.json().catch(() => ({}))) as
    | T
    | { error: ApiError };
  if (!res.ok) {
    const apiErr = (json as { error?: ApiError }).error ?? {
      code: "UNKNOWN",
      message: "网络错误，请稍后重试",
    };
    return { ok: false, status: res.status, error: apiErr };
  }
  return { ok: true, data: json as T };
}

export function useAuth() {
  const setAuth = useAppStore((s) => s.setAuth);
  const setSessionState = useAppStore((s) => s.setSessionState);
  const setAuthError = useAppStore((s) => s.setAuthError);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const user = useAppStore((s) => s.user);
  const sessionState = useAppStore((s) => s.sessionState);
  const authError = useAppStore((s) => s.authError);

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setAuthError(null);
      const result = await postJson<{
        userId: string;
        email: string;
        username: string;
        confirmationRequired: boolean;
        message: string;
      }>("/api/auth/register", payload);
      if (!result.ok) {
        setAuthError(result.error.message);
        return result;
      }
      setSessionState("pending-email-confirm");
      return result;
    },
    [setAuthError, setSessionState],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      setAuthError(null);
      const result = await postJson<{
        userId: string;
        email: string;
        username: string;
      }>("/api/auth/login", payload);
      if (!result.ok) {
        setAuthError(result.error.message);
        return result;
      }
      setAuth({
        userId: result.data.userId,
        email: result.data.email,
        username: result.data.username,
        usernameDisplay: result.data.username,
      });
      return result;
    },
    [setAuth, setAuthError],
  );

  const logout = useCallback(async () => {
    await postJson("/api/auth/logout", {});
    clearAuth();
  }, [clearAuth]);

  return {
    user,
    sessionState,
    authError,
    register,
    login,
    logout,
  };
}
