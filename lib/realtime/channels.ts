/**
 * Supabase Realtime 频道与事件常量。
 *
 * 所有刷新均通过 Realtime Broadcast 推送；客户端订阅 `data-updated` 频道，
 * 在事件 payload 上判 EventKind 后做局部 cacheInvalidate（FR-106 / FR-108）。
 *
 * 与 contracts/realtime-events.md 的"事件枚举"一一对应。
 */

export const REALTIME_CHANNEL = "data-updated" as const;

/** 与 sealos/scheduler/realtime/publish.py 共同维护的 EventKind 常量集合 */
export const EventKind = {
  StockDailyMidday: "stock-daily-midday",
  StockDailyClose: "stock-daily-close",
  NewsFetchDone: "news-fetch-done",
  NewsSummaryDone: "news-summary-done",
  AiMiddayDone: "ai-midday-done",
  AiEveningDone: "ai-evening-done",
  AiForecastDone: "ai-forecast-done",
  SectorPicksDone: "sector-picks-done",
  CalendarRefreshDone: "calendar-refresh-done",
  ManualRefreshDone: "manual-refresh-done",
} as const;

export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/**
 * 受影响的 Dashboard 板块名集合（用于 cacheInvalidate 前缀映射）。
 * 与 contracts/realtime-events.md "客户端订阅与局部刷新映射"段保持一致。
 */
export type AffectedBoard =
  | "indices"
  | "launching-soon"
  | "main-uptrend"
  | "watchlist"
  | "market-status"
  | "news-list"
  | "ai-midday"
  | "ai-evening"
  | "ai-forecast"
  | "sector-picks";

export interface RealtimePayload {
  kind: EventKind;
  /** 受影响板块；客户端按此调 cacheInvalidate */
  affectedBoards: AffectedBoard[];
  /** 事件发生时间 ISO 8601 */
  occurredAt: string;
  /** 任意上下文（trade_date / batch_id 等），具体字段按 EventKind 约定 */
  meta?: Record<string, unknown>;
}

/** EventKind → 默认 affectedBoards 映射（与 sealos publish 保持一致） */
export const DEFAULT_AFFECTED_BOARDS: Record<EventKind, AffectedBoard[]> = {
  [EventKind.StockDailyMidday]: [
    "indices",
    "launching-soon",
    "main-uptrend",
    "watchlist",
    "market-status",
  ],
  [EventKind.StockDailyClose]: [
    "indices",
    "launching-soon",
    "main-uptrend",
    "watchlist",
    "market-status",
  ],
  [EventKind.NewsFetchDone]: ["news-list"],
  [EventKind.NewsSummaryDone]: ["news-list"],
  [EventKind.AiMiddayDone]: ["ai-midday"],
  [EventKind.AiEveningDone]: ["ai-evening"],
  [EventKind.AiForecastDone]: ["ai-forecast", "sector-picks"],
  [EventKind.SectorPicksDone]: ["sector-picks"],
  [EventKind.CalendarRefreshDone]: ["market-status"],
  [EventKind.ManualRefreshDone]: [
    "indices",
    "launching-soon",
    "main-uptrend",
    "watchlist",
    "news-list",
  ],
};
