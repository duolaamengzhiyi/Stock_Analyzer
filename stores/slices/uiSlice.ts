/**
 * 全局 UI slice：侧栏开合、主题、横幅关闭状态等。
 * 持久化字段使用 partialize（写入 root store 时显式声明）。
 */
import type { StateCreator } from "zustand";

export type Theme = "light" | "dark" | "system";

export interface UiSlice {
  /** 桌面侧栏是否展开（hover 控制；移动端走 sideNavMobileOpen） */
  sideNavExpanded: boolean;
  setSideNavExpanded: (v: boolean) => void;

  /** 移动端抽屉式侧栏是否打开 */
  sideNavMobileOpen: boolean;
  setSideNavMobileOpen: (v: boolean) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;

  /**
   * A 股休市横幅的关闭状态（FR-121）。
   * key 格式 'banner-dismissed-{YYYY-MM-DD}'，按 Asia/Shanghai 自然日存。
   */
  bannerDismissed: Record<string, true>;
  dismissBanner: (dateKey: string) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  sideNavExpanded: false,
  setSideNavExpanded: (v) => set({ sideNavExpanded: v }),

  sideNavMobileOpen: false,
  setSideNavMobileOpen: (v) => set({ sideNavMobileOpen: v }),

  theme: "system",
  setTheme: (t) => set({ theme: t }),

  bannerDismissed: {},
  dismissBanner: (dateKey) =>
    set((s) => ({
      bannerDismissed: { ...s.bannerDismissed, [dateKey]: true as const },
    })),
});
