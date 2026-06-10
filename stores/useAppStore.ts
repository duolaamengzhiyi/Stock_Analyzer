/**
 * 单一根 store（宪法原则七：Zustand 唯一全局状态方案）。
 * 通过 slice 组合方式聚合所有子状态；持久化字段以 partialize 显式枚举。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createCacheSlice, type CacheSlice } from "./slices/cacheSlice";
import { createRealtimeSlice, type RealtimeSlice } from "./slices/realtimeSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";

export type AppState = CacheSlice & UiSlice & RealtimeSlice;

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createCacheSlice(set, get, api),
      ...createUiSlice(set, get, api),
      ...createRealtimeSlice(set, get, api),
    }),
    {
      name: "stock-analyzer-app",
      version: 1,
      // 仅持久化 UI 偏好与休市横幅关闭状态；缓存/Realtime 状态进程内
      partialize: (state) => ({
        sideNavExpanded: state.sideNavExpanded,
        theme: state.theme,
        bannerDismissed: state.bannerDismissed,
      }),
    },
  ),
);

export type AppStore = typeof useAppStore;
