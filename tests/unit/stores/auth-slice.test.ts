/**
 * T061 [US1] authSlice action / selector 单测。
 */
import { describe, it, expect, beforeEach } from "vitest";

import { useAppStore } from "@/stores/useAppStore";

function reset() {
  useAppStore.setState({
    user: null,
    sessionState: "unknown",
    authError: null,
    rememberMe: false,
  });
}

describe("authSlice", () => {
  beforeEach(reset);

  it("setAuth(user) 设置用户并切到 authenticated 且清掉 authError", () => {
    useAppStore.getState().setAuthError("oops");
    useAppStore.getState().setAuth({
      userId: "u1",
      email: "a@b.com",
      username: "alice",
      usernameDisplay: "Alice",
    });
    const s = useAppStore.getState();
    expect(s.user?.userId).toBe("u1");
    expect(s.sessionState).toBe("authenticated");
    expect(s.authError).toBeNull();
  });

  it("setAuth(null) 切到 unauthenticated", () => {
    useAppStore.getState().setAuth(null);
    expect(useAppStore.getState().sessionState).toBe("unauthenticated");
  });

  it("setSessionState 直接覆盖（用于 pending-email-confirm）", () => {
    useAppStore.getState().setSessionState("pending-email-confirm");
    expect(useAppStore.getState().sessionState).toBe("pending-email-confirm");
  });

  it("clearAuth 清掉 user 与错误，切到 unauthenticated", () => {
    useAppStore.getState().setAuth({
      userId: "u1",
      email: "a@b.com",
      username: "alice",
      usernameDisplay: "Alice",
    });
    useAppStore.getState().setAuthError("某错误");
    useAppStore.getState().clearAuth();
    const s = useAppStore.getState();
    expect(s.user).toBeNull();
    expect(s.authError).toBeNull();
    expect(s.sessionState).toBe("unauthenticated");
  });

  it("setRememberMe 持久化字段切换", () => {
    useAppStore.getState().setRememberMe(true);
    expect(useAppStore.getState().rememberMe).toBe(true);
  });
});
