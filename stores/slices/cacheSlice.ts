/**
 * 通用缓存 slice（FR-061 / FR-107）。
 *
 * - key: 业务自定义命名空间（如 'screens:launching-soon:2026-04-22'）
 * - TTL：默认 60s，调用方可覆盖
 * - 不持久化到 localStorage（页面关闭即丢，进程内热缓存）
 */
import type { StateCreator } from "zustand";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheSlice {
  cache: Record<string, CacheEntry<unknown>>;
  /** 写入并设置过期时间。ttlMs 默认 60_000 */
  cacheSet: <T>(key: string, value: T, ttlMs?: number) => void;
  /** 读取；过期返回 undefined（不主动清理） */
  cacheGet: <T>(key: string) => T | undefined;
  /** 删除单个 key */
  cacheDelete: (key: string) => void;
  /** 让 prefix 命中的全部 key 失效（用于 Realtime 事件按板块批量 invalidate） */
  cacheInvalidate: (prefix: string) => void;
}

const DEFAULT_TTL_MS = 60_000;

export const createCacheSlice: StateCreator<CacheSlice, [], [], CacheSlice> = (
  set,
  get,
) => ({
  cache: {},
  cacheSet: (key, value, ttlMs = DEFAULT_TTL_MS) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { value, expiresAt: Date.now() + ttlMs },
      },
    }));
  },
  cacheGet: <T>(key: string): T | undefined => {
    const entry = get().cache[key];
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) return undefined;
    return entry.value as T;
  },
  cacheDelete: (key) => {
    set((state) => {
      if (!(key in state.cache)) return state;
      const { [key]: _omit, ...rest } = state.cache;
      void _omit;
      return { cache: rest };
    });
  },
  cacheInvalidate: (prefix) => {
    set((state) => {
      const next: Record<string, CacheEntry<unknown>> = {};
      for (const [k, v] of Object.entries(state.cache)) {
        if (!k.startsWith(prefix)) next[k] = v;
      }
      return { cache: next };
    });
  },
});
