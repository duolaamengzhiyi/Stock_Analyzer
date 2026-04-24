# Contract: Supabase Realtime Events

**Feature**: 001-initialization
**Date**: 2026-04-22
**所在位置**:
 - 发布方：`sealos/scheduler/realtime/publish.py`
 - 订阅方：`hooks/useRealtimeChannel.ts`, `stores/slices/realtimeSlice.ts`

---

## 频道 & 订阅模型

**频道名**：`data-updated`（单频道全广播）
**权限**：所有已登录用户都有订阅权（事件 payload 不含敏感字段）
**发送方式**：Supabase Realtime **Broadcast**（非 Postgres Changes）

### 为何选 Broadcast 而不是 Postgres Changes

- Broadcast 不依赖表变更触发，发布方可自由组织 payload（含 sourceDataAt
  / generatedAt / affectedBoards 等衍生信息）
- 避免为所有涉及的表单独开 replication slot 与 RLS 重配置

---

## 事件通用信封

```ts
type RealtimeDataUpdatedEvent = {
  event: EventKind;
  payload: {
    kind: EventKind;              // 与 event 一致，冗余便于消费
    sourceDataAt: string;         // ISO8601，作为 spec FR-052 的 source_data_at
    generatedAt: string;          // ISO8601，作为 spec FR-052 的 generated_at
    tradeDate?: string;           // YYYY-MM-DD，适用于股票相关事件
    affectedBoards: BoardKey[];   // 前端应 invalidate 的板块缓存 key
    meta?: Record<string, unknown>; // 自由扩展
  };
};
```

---

## 事件枚举

```ts
type EventKind =
  | 'stock-daily-midday'
  | 'stock-daily-close'
  | 'news-fetch-done'
  | 'ai-midday-done'
  | 'ai-evening-done'
  | 'ai-forecast-done'
  | 'news-summary-done'
  | 'sector-picks-done'
  | 'calendar-refresh-done'
  | 'manual-refresh';   // 手动刷新按钮（前端自发，仅本页生效）

type BoardKey =
  | 'indices'
  | 'launching-soon'
  | 'main-uptrend'
  | 'watchlist'
  | 'ai-midday'
  | 'ai-evening'
  | 'ai-forecast'
  | 'news-summary'
  | 'news-list'
  | 'sector-picks'
  | 'market-status';
```

---

## 各事件 payload 示例

### `stock-daily-close`

最重要的一次广播：收盘数据 + 筛选结果一次到位。

```json
{
  "event": "stock-daily-close",
  "payload": {
    "kind": "stock-daily-close",
    "tradeDate": "2026-04-22",
    "sourceDataAt": "2026-04-22T15:15:00+08:00",
    "generatedAt": "2026-04-22T15:17:45+08:00",
    "affectedBoards": [
      "indices",
      "launching-soon",
      "main-uptrend",
      "watchlist",
      "market-status"
    ]
  }
}
```

### `ai-midday-done` / `ai-evening-done` / `ai-forecast-done`

```json
{
  "event": "ai-midday-done",
  "payload": {
    "kind": "ai-midday-done",
    "tradeDate": "2026-04-22",
    "sourceDataAt": "2026-04-22T11:30:00+08:00",
    "generatedAt": "2026-04-22T11:38:12+08:00",
    "affectedBoards": ["ai-midday"]
  }
}
```

### `news-summary-done`

```json
{
  "event": "news-summary-done",
  "payload": {
    "kind": "news-summary-done",
    "sourceDataAt": "2026-04-22T21:05:00+08:00",
    "generatedAt": "2026-04-22T21:08:30+08:00",
    "affectedBoards": ["news-summary"]
  }
}
```

### `sector-picks-done`

```json
{
  "event": "sector-picks-done",
  "payload": {
    "kind": "sector-picks-done",
    "tradeDate": "2026-04-22",
    "sourceDataAt": "2026-04-22T21:05:00+08:00",
    "generatedAt": "2026-04-22T21:12:00+08:00",
    "affectedBoards": ["sector-picks"]
  }
}
```

### `calendar-refresh-done`

```json
{
  "event": "calendar-refresh-done",
  "payload": {
    "kind": "calendar-refresh-done",
    "sourceDataAt": "2026-04-26T03:00:00+08:00",
    "generatedAt": "2026-04-26T03:00:45+08:00",
    "affectedBoards": ["market-status"]
  }
}
```

---

## 客户端订阅与局部刷新映射

`hooks/useRealtimeChannel.ts` 维护从 `BoardKey` 到 cache-invalidate 动作的
映射表：

```ts
const INVALIDATE_MAP: Record<BoardKey, () => void> = {
  'indices': () => cacheSlice.invalidate('dashboard:indices'),
  'launching-soon': () => cacheSlice.invalidate('screens:launching-soon'),
  'main-uptrend': () => cacheSlice.invalidate('screens:main-uptrend'),
  'watchlist': () => cacheSlice.invalidate('watchlist:current'),
  'ai-midday': () => cacheSlice.invalidate('ai:midday'),
  'ai-evening': () => cacheSlice.invalidate('ai:evening'),
  'ai-forecast': () => cacheSlice.invalidate('ai:forecast'),
  'news-summary': () => cacheSlice.invalidate('news:summary'),
  'news-list': () => cacheSlice.invalidate('news:list'),
  'sector-picks': () => cacheSlice.invalidate('sector-picks'),
  'market-status': () => cacheSlice.invalidate('dashboard:market-status'),
};
```

订阅处理流程：

```ts
channel.on('broadcast', { event: '*' }, (msg) => {
  const ev = msg.payload as RealtimeDataUpdatedEvent;
  for (const board of ev.payload.affectedBoards) {
    INVALIDATE_MAP[board]?.();
  }
});
```

Invalidate 后，对应 board 的 React Hook 自动触发重新拉取（通过 Zustand
selector 变更感知），本板块内展示骨架屏直到新数据到位（宪法原则五）。

---

## 断连 / 重连策略（FR-10A）

- 连接断开：Supabase JS 客户端自动尝试重连（指数退避，封顶 30s）
- 重连成功：自发一次 `manual-refresh` 事件（仅本会话），`invalidateAll()`
  让所有板块重拉，保证与服务端一致
- 断开超过 5 分钟：Dashboard 顶部显示"实时同步已断开，请手动刷新"
  （FR-10A 降级提示）

客户端代码骨架（`realtimeSlice.ts`）：

```ts
type RealtimeState = {
  status: 'connecting' | 'connected' | 'disconnected';
  lastDisconnectedAt?: string;
  connect: () => void;
  disconnect: () => void;
};
```

---

## 安全考虑

- Broadcast 不含敏感字段（无 userId / token / Kimi raw response），全员
  可读符合 RLS 要求
- Realtime 频道的 RLS 策略：允许 `authenticated` 角色订阅 `data-updated`
  频道，不允许 `anon` 订阅（未登录用户在重定向后才看到 Dashboard）

---

## 调试 / 观测

- Scheduler 侧每次广播同时写一条 `audit_logs(kind='realtime-broadcast')`
  （可选；本期若担心 audit 表膨胀可省）
- 前端 `realtimeSlice.lastEventAt` 暴露给 Dashboard 顶部的小字"上次推送
  XX 秒前"（调试用，可通过 env flag 开关）
