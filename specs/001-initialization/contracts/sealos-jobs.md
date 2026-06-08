# Contract: Sealos Scheduler Jobs

**Feature**: 001-initialization
**Date**: 2026-04-22
**所在位置**: `sealos/scheduler/jobs/*.py`（Python，由 APScheduler 调度）
**公共契约**: 每个 job 的输入（调度时机）、输出（DB 写入 + Realtime 广播）、
失败处理、审计记录

---

## 通用约定

**运行环境**：Sealos 内部容器，TZ=`Asia/Shanghai`。
**数据库访问**：通过 `supabase-py` + `SUPABASE_SERVICE_ROLE_KEY`，**严禁**
DDL（仅 CRUD）。
**失败策略**：任何 job 失败 **不得** 覆盖既有成功数据（FR-023 / FR-031）；
异常以 `audit_logs(status='failed')` 记录；失败时不广播 Realtime。
**休市日跳过**：stock / midday / evening job 在执行前查询 `market_calendar
(market='CN_A', date=today)`；若 `is_open=false` 直接跳过并写
`audit_logs(status='skipped')`（FR-124）。
**手动触发**：每个 job 同时暴露 HTTP 端点 `POST /trigger/<job_id>`
带 `X-Scheduler-Token`，便于运维 / 首次部署回填。

---

## Job: `initial_backfill`

**调度**：手动触发一次；首次启动前必须跑完。
**依赖**：`stocks` 表已预填全量元数据（可通过 `stock_zh_a_spot_em` 一次拉取
写入）。

```yaml
input: (无，自动判定是否需要跑)
preconditions:
  - 读取 audit_logs: 若存在 kind='initial-backfill' AND status='success'
    则跳过并记录 'already-done'，退出
steps:
  1. 调 aktools.stock_zh_a_spot_em() 拉全量股票快照（含市值、板块、ST 标记），
     UPSERT 到 stocks 表
  2. 调 aktools.tool_trade_date_hist_sina() 拉历史交易日列表，
     取最近 60 个交易日
  3. 并发（limit=10）调 aktools.stock_zh_a_hist(symbol=code, start_date=T-60)
     对每只股票拉 60 日历史 K 线，写入 stock_daily
  4. 调 aktools.stock_board_concept_name_em() + stock_board_concept_cons_em()
     建立 stock.concepts 反查并写回 stocks.concepts
outputs:
  - stocks: ~5500 rows (upsert)
  - stock_daily: ~330,000 rows (insert)
  - audit_logs: initial-backfill status=success
  - Realtime broadcast: none (首次回填不广播，此时 Vercel 可能还没部署)
failure_handling:
  - 整体事务不可原子（跨 HTTP call），用 idempotent upsert 保证重跑幂等
  - 失败中止，仅写 audit_logs status=failed，下次手动重试
expected_duration: 3–10 分钟（取决于 AKTools 实例性能 + 并发）
```

---

## Job: `stock_daily_midday`

**Cron**: `30 11 * * 1-5`（每交易日 11:30 后，抓午盘数据）

```yaml
preconditions:
  - 查 market_calendar: is_open(CN_A, today) = true
  - 若 false: audit_logs skipped + exit
steps:
  1. 调 aktools.stock_zh_a_spot_em() 拉当日全量快照
  2. UPSERT stocks（市值、ST 标记可能变化）
  3. INSERT stock_daily WHERE trade_date=today（若已有 row 则 ON CONFLICT UPDATE）
  4. 删除 stock_daily 中 trade_date < T-60 的行（滚动清理 FR-022）
  5. audit_logs insert: stock-fetch success kind='stock-daily-midday'
  6. Supabase Realtime broadcast: channel='data-updated', event='stock-daily-midday'
outputs:
  - stock_daily: ~5500 rows（当日）
  - audit_logs + Realtime event
failure_handling:
  - AKTools HTTP 错误 / 超时：retry 最多 3 次，间隔 30s
  - 全部失败 → audit_logs status=failed；既有 stock_daily 保持不变
expected_duration: 30s–2min
```

---

## Job: `stock_daily_close`

**Cron**: `15 15 * * 1-5`（每交易日 15:15 后，抓尾盘数据 + 触发筛选）

```yaml
preconditions: 同 stock_daily_midday
steps:
  1–4. 同 stock_daily_midday
  5. 调 screens.launching_soon.compute(today) 算出启动在即列表
  6. 调 screens.main_uptrend.compute(today) 算出主升浪列表
  7. 在单事务内 DELETE + INSERT stock_screen_results
     WHERE (trade_date, kind) IN (('today','launching-soon'), ('today','main-uptrend'))
  8. audit_logs: stock-fetch + screens-compute success
  9. Realtime broadcast: event='stock-daily-close'
     （前端收到后 invalidate launching-soon + main-uptrend + indices）
outputs:
  - stock_daily: ~5500 rows
  - stock_screen_results: ≤ 40 rows (20 × 2)
  - audit_logs + Realtime event
failure_handling:
  - 筛选失败不影响 stock_daily 落库：4 步成功即算抓取成功，筛选在 7 步里独立事务
```

---

## Job: `news_fetch_*`（四个触发时刻）

**Cron**:

- `news_fetch_with_stock_morning`: `35 11 * * 1-5`
- `news_fetch_with_stock_close`: `20 15 * * 1-5`
- `news_fetch_evening`: `0 21 * * *`（每天，不限交易日）
- `news_fetch_dawn`: `0 6 * * *`（每天）

```yaml
steps:
  1. 调 aktools.stock_telegraph_cls() 拉最近电报（默认约 500 条）
  2. 按 (source, external_id) UPSERT 到 news_items（已存在则跳过）
  3. 删除 news_items WHERE published_at < now() - 7d
  4. audit_logs: news-fetch success
  5. Realtime broadcast: event='news-fetch-done'
outputs:
  - news_items: 新增 ~50 rows（增量去重后）
  - audit_logs + Realtime event
```

---

## Job: `ai_midday` / `ai_evening`

**Cron**:

- `ai_midday`: `40 11 * * 1-5`（11:40，给 stock-daily 留 10 分钟）
- `ai_evening`: `25 15 * * 1-5`（15:25）

```yaml
preconditions:
  - market_calendar.is_open(CN_A, today) = true
  - stock_daily 最新一条 trade_date = today（说明抓取已成功）
steps:
  1. 读 stock_daily today 的全量（从中聚合指数 / 涨跌家数 / 成交额 / 活跃板块）
  2. 构造 prompt（用 lib/deepseek/prompts.ts 镜像的 builder）
  3. 调 DeepSeek LLM
  4. INSERT ai_artifacts(kind='midday'|'evening', primary_key=today,
     content=<response>, generated_at=now, source_data_at=today 11:30|15:15)
  5. audit_logs: ai-generate success
  6. Realtime broadcast: event='ai-midday-done'|'ai-evening-done'
failure_handling:
  - DeepSeek 失败 → audit_logs status=failed；**不**写 ai_artifacts；下一调度窗口重试
  - 前端继续显示上一版本（FR-053）
```

---

## Job: `ai_forecast`

**Cron**: `10 21 * * *` 和 `10 6 * * *`（每天两次，不限交易日）

```yaml
preconditions: news_items 最近 1h 内有 fetch 成功
steps:
  1. 读最近 24h news_items
  2. 读最近 3 日 stock_daily 聚合市场概要
  3. 读国际 5 市场 indices（若 Scheduler 另抓了；本期可先跳过，prompt 中提及"暂无海外数据"）
  4. 构造 forecast prompt
  5. 调 DeepSeek (deepseek-v4-flash；1M 上下文，可注入 24h 全量 CLS + 多日行情)
  6. INSERT ai_artifacts(kind='forecast', primary_key=today, content, source_data_at=批次时间)
  7. 调用 sector_picks 子任务（下面一条）
  8. audit_logs + Realtime broadcast
```

---

## Job: `sector_picks`（作为 `ai_forecast` 的后续）

**触发**：`ai_forecast` 成功完成后立即运行（代码内部触发，不单独 cron）。

```yaml
steps:
  1. 从 ai_forecast.content 中用 regex / 简单 parser 抽取概念板块名称列表（≤ 5）
  2. 对每个板块调 aktools.stock_board_concept_cons_em(板块名) 拿成分股
  3. 对每个成分股：
     a. 查 stock_daily 最近 5 日 + 概念指数（stock_board_concept_hist_em）
     b. 计算 close[T-1]/close[T-5] 的超额收益（相对板块指数）
  4. 按超额收益降序；若该股票 ST / 停牌 / 当日涨跌幅缺失则跳过至下一位
  5. 取 rank=1 的股票为龙头（FR-072）
  6. 单事务 DELETE + INSERT sector_picks WHERE trade_date=today
  7. Realtime broadcast: event='sector-picks-done'
```

---

## Job: `news_summary`

**触发**：`news_fetch_evening`（21:00）成功后；每日只生成一次。

```yaml
steps:
  1. 读最近 24h news_items
  2. 构造 news-summary prompt
  3. 调 DeepSeek (deepseek-v4-flash)
  4. INSERT ai_artifacts(kind='news-summary', primary_key=batch_iso_ts)
  5. Realtime broadcast: event='news-summary-done'
```

---

## Job: `cleanup`

**Cron**: `0 4 * * *`（每天凌晨 4 点，所有交易所都已关闭）

```yaml
steps:
  1. DELETE stock_daily WHERE trade_date < (最近一个 A 股交易日 - 60d)
  2. DELETE news_items WHERE published_at < now() - 7d
  3. DELETE long_lived_tokens WHERE revoked_at < now() - 30d
  4. audit_logs: cleanup success
outputs: 不广播 Realtime（清理对用户无感）
```

---

## Job: `calendar_refresh`

**Cron**: `0 3 * * 0`（每周日 3am）

```yaml
steps:
  1. 调 aktools.tool_trade_date_hist_sina() 刷新 CN_A 交易日
  2. 用 pandas_market_calendars 生成未来 90 天 US/HK/JP/KR 的开休市标记
  3. UPSERT market_calendar
  4. 删除 date < now() - 180d 的历史记录
  5. audit_logs: calendar-refresh success
```

---

## Realtime broadcast payload 约定

所有 Realtime 广播走同一频道 `data-updated`，事件类型通过 `event` 字段区分：

```json
{
  "event": "stock-daily-close",
  "payload": {
    "kind": "stock-daily-close",
    "sourceDataAt": "2026-04-22T15:15:00+08:00",
    "generatedAt": "2026-04-22T15:17:30+08:00",
    "affectedBoards": ["indices", "launching-soon", "main-uptrend", "watchlist"]
  }
}
```

事件详细契约见 `realtime-events.md`。

---

## 对外 HTTP 管理端点

Scheduler 暴露以下 HTTPS 端点（需 `X-Scheduler-Token` 头）：

| Method | Path | 用途 |
|--------|------|------|
| `POST` | `/trigger/<job_id>` | 手动触发任一 job |
| `GET` | `/jobs` | 列出所有已注册 job 的下次运行时间 |
| `GET` | `/health` | 健康检查（Sealos 内探针用） |
| `GET` | `/metrics` | 最近 7 天各 job 成功率（从 audit_logs 聚合） |

`<job_id>` 枚举：`initial-backfill`, `stock-daily-midday`, `stock-daily-close`,
`news-fetch-*`（4 个），`ai-midday`, `ai-evening`, `ai-forecast`,
`news-summary`, `sector-picks`, `cleanup`, `calendar-refresh`。

---

## 失败告警策略（本期简化）

本期 **不**引入独立告警系统（PagerDuty / Slack 等）。所有失败事件仅写
`audit_logs`，运维通过 `/metrics` 或 Supabase Dashboard 查询
`audit_logs WHERE status='failed'` 发现。Dashboard 侧对用户展示"数据截止
至上次成功时间"的降级提示（FR-023 / SC-010）。

未来可以在"管理后台"feature 加一个 Supabase Webhook → Slack 通知。
