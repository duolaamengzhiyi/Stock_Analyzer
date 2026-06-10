/**
 * Realtime 连接状态 slice 骨架（Phase 15 完整 reducer 在 T189 补完）。
 *
 * 状态机：
 *   idle → connecting → open → (degraded | reconnecting | closed)
 * 重连：指数退避（FR-111），5 分钟仍未恢复则切 degraded（向用户提示降级）。
 */
import type { StateCreator } from "zustand";

export type RealtimeState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "degraded"
  | "closed";

export interface RealtimeSlice {
  realtimeState: RealtimeState;
  /** 自上次 open 起的累计重连次数，open 时归零 */
  reconnectAttempts: number;
  /** 最近一次进入 reconnecting 的时间戳（ms），用于计算 5 分钟降级窗口 */
  reconnectingSince: number | null;
  /** 已经收到过的事件计数（按 EventKind） */
  eventCounts: Record<string, number>;

  setRealtimeState: (s: RealtimeState) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  recordEvent: (kind: string) => void;
}

export const createRealtimeSlice: StateCreator<
  RealtimeSlice,
  [],
  [],
  RealtimeSlice
> = (set) => ({
  realtimeState: "idle",
  reconnectAttempts: 0,
  reconnectingSince: null,
  eventCounts: {},

  setRealtimeState: (s) =>
    set((prev) => ({
      realtimeState: s,
      reconnectingSince:
        s === "reconnecting" && prev.realtimeState !== "reconnecting"
          ? Date.now()
          : s === "open"
            ? null
            : prev.reconnectingSince,
    })),

  incrementReconnect: () =>
    set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),

  resetReconnect: () =>
    set({ reconnectAttempts: 0, reconnectingSince: null }),

  recordEvent: (kind) =>
    set((s) => ({
      eventCounts: { ...s.eventCounts, [kind]: (s.eventCounts[kind] ?? 0) + 1 },
    })),
});
