# Phase 0: Research — Stock Analyzer Platform Initialization

**Feature**: 001-initialization
**Date**: 2026-04-22
**目的**: 对 plan.md Technical Context 中尚未固化的技术决策逐条给出
**Decision / Rationale / Alternatives**。每一条决策都是后续 Phase 1
（data-model / contracts / quickstart）的前置条件。

---

## R1. 双层架构：Vercel (Next.js) + Sealos (Python Scheduler)

**Decision**: 所有"用户请求"由 Vercel 承担（页面渲染、认证、读库、用户
触发的 AI 按需调用），所有"后台定时任务"由 Sealos 上的独立 Python
Scheduler 承担（AKTools 数据抓取、DeepSeek 批量生成、Realtime 广播）。两者
共享 Supabase Postgres + Supabase Realtime 作为唯一同步面。

**Rationale**:

- Vercel Hobby 的 Cron 限制为 2 次/日，而 spec 需要 4 次（11:30 / 15:15 /
  21:00 / 06:00）；用 Pro 虽无限制但 Serverless Function 最长 60s timeout，
  60 天历史回填 / 全量 5500 只股票抓取会超时（历史回填预计 3~10 分钟）。
- Sealos 长驻 Python 服务天然无 timeout 限制，且 AKTools 的原生接口就是
  Python AKShare 的 HTTP 包装，同语言调用最顺。
- Supabase Realtime 作为"共享事件总线"让 Scheduler 写入后立即通知 Vercel
  前端，避免 Vercel 反向轮询 Sealos。
- 双层的**唯一耦合面**是 Supabase 表与 Realtime 频道，schema 由 Drizzle 独占
  管理，故两层可以独立部署独立迭代。

**Alternatives considered**:

- **纯 Vercel Cron + Edge / Serverless Function**：受 60s timeout + Hobby
  2 次/日限制，6 万行数据的 60 天历史回填无法完成，被拒。
- **Supabase pg_cron + pg_net 调用 Sealos AKTools**：概念优雅但 pg_net
  extension 调用 HTTP 的失败重试、错误观测、超时处理都较弱，调试不友好；
  且 DeepSeek 调用逻辑要写在 PL/pgSQL 里或 Edge Function 里，分散维护。
- **Supabase Edge Functions（Deno）全包**：150s timeout + 冷启动 ~100ms，
  但 Python AKShare 生态更完整（`stock_zh_a_hist`、`stock_board_concept_*`
  等接口在 Deno / TypeScript 侧没有同等级封装），需要自己维护 HTTP 包装。

---

## R2. Sealos 上部署两个服务：AKTools HTTP + Python Scheduler

**Decision**: 在 Sealos **App Launchpad** 部署两个独立 App：

1. `aktools` —— 官方镜像 `akfamily/aktools:latest`，暴露 HTTP 8080，供
   Scheduler 内部调用。**内网访问**即可，不公开到互联网。
2. `scheduler` —— 项目自建镜像 `sealos/scheduler/`，含 APScheduler + FastAPI，
   APScheduler 按 Asia/Shanghai 时区触发各 job。**公开一个 HTTPS 端点**
   `POST /trigger/<job>` 带 `X-Scheduler-Token` 用于手动触发（运维用）。

**Rationale**:

- AKTools 官方镜像已稳定（GitHub `akfamily/aktools`），无需自建。
- 把 AKTools 与 Scheduler 拆成两个 App 使得 AKTools 可被多个 Scheduler 版本
  滚动共享；且 Scheduler 故障重启不会拉低 AKTools 可用性。
- Sealos 内网 DNS（如 `aktools.ns-<namespace>.svc.cluster.local:8080`）零配置
  互通，无需公网回环。

**Alternatives considered**:

- **单容器混部**：一个镜像内跑 supervisor + aktools + scheduler，运维简单但
  AKTools 升级必须伴随 Scheduler 重启，耦合过紧。
- **AKTools 跑在 Vercel / Supabase**：AKTools 本质是 FastAPI + Python，
  Vercel 不支持长驻 Python 进程，Supabase Edge 不跑 Python，被拒。

---

## R3. Supabase Auth + 真实邮箱注册登录

**Decision**: 注册时前端提交真实邮箱 + 账号名 + 密码 → 服务端 Route Handler
校验邮箱格式、邀请码、账号名正则（`^[A-Za-z0-9_-]{3,20}$`，FR-008），将邮箱
trim + 小写规范化后直接调用 Supabase Auth 的 `signUp`；业务表 `profiles`
保存 `{ user_id, username, created_at }` 作为站内唯一显示名。登录时前端提交
邮箱 + 密码，服务端直接调用 `signInWithPassword({ email, password })`。
Supabase Auth 的 **Confirm email 必须开启**，注册完成后用户需点击真实邮箱中的
确认链接再建立有效会话。

**Rationale**:

- 宪法硬约束使用 Supabase Auth；Supabase Auth 默认以 email 为主身份标识，
  使用真实邮箱可以直接走内建的邮箱确认、未来密码找回和安全审计能力。
- 开启 Confirm email 后能验证邮箱归属，避免用户用无法接收邮件的地址注册；
  这也使 Supabase 的安全默认值与产品流程一致。
- `profiles` 表同时承载"显示名"与其它 per-user 元数据（如 `nickname` 日后
  扩展），清爽。
- 7 天免登录通过 Supabase session 的 `expiresIn` 参数实现，refresh token
  自动续期，符合 FR-004。

**Alternatives considered**:

- **NextAuth**：spec Assumptions 已记录为"被拒绝备选方案"（宪法冲突 +
  RLS 集成代价 + 用户表重复 + 边际收益小）。
- **完全自研认证**（bcrypt + JWT + cookie）：违反宪法硬约束，RLS 无法利用
  `auth.uid()`。
- **Supabase Auth 占位邮箱包装账号名**：旧方案用
  `{username}@stock-analyzer.local` 绕过 email 字段要求，但如果开启邮箱确认，
  Supabase 会把确认信发到不可接收的假邮箱；如果关闭邮箱确认，又失去真实邮箱
  校验与未来密码找回能力。因此改为真实邮箱。
- **用户名作为唯一 ID 注入 Supabase metadata**：Supabase Auth 不支持以
  metadata 字段作为登录凭证，仍需 email；此路不通。

---

## R4. 客户端状态：Zustand 5 根 store + slice 组合

**Decision**: `stores/useAppStore.ts` 组合 5 个 slice：

```text
authSlice       session / 当前用户 profile
watchlistSlice  自选列表（持久化 draft 字段防误删）
cacheSlice      所有请求结果缓存（key + TTL + status）
uiSlice         侧栏展开 / 横幅关闭状态（持久化）
realtimeSlice   Supabase Realtime 连接状态 + 断连重连
```

组件订阅用细粒度 selector + `shallow`；`persist` middleware + `partialize`
仅序列化 `uiSlice`（主题 / 侧栏 / 横幅）与 `watchlistSlice.draft`；`cacheSlice`
与 `realtimeSlice` 不持久化（会话级即可）。

**Rationale**:

- 宪法原则七强制"系统级唯一根 store + 模块化 slice + 请求结果缓存"——
  这是对应的直接落地。
- `cacheSlice` 统一承担 FR-107（Realtime 推送后局部刷新）与 FR-061（跨路由
  不空白重载）的缓存职责，所有业务 Hook 走"查缓存 → 未命中取数 → 写回"统一
  路径。
- 拖拽排序 draft 持久化保证用户刷新页面不丢失未保存的重排意图。

**Alternatives considered**:

- **Tanstack Query + Zustand 并用**：Tanstack Query 自带请求缓存与重试，
  但引入了第二套"状态机"（query key vs store key），跟宪法"唯一 store"的
  精神相冲。且 FR-108 禁用 refreshInterval，Query 的主要卖点被阉割。
- **SWR**：同上。
- **纯 React Context + useReducer**：违反宪法禁令。

---

## R5. 数据刷新机制：Supabase Realtime 推送 + 手动刷新按钮

**Decision**: Scheduler 完成任一事件（`stock-daily` / `ai-midday` /
`ai-evening` / `ai-forecast` / `news-summary` / `sector-picks`）后，通过
`supabase.channel('data-updated').send(...)` 广播带 payload 的事件；前端
`realtimeSlice` 订阅并按 payload 的 `kind` 字段 invalidate 对应 cache key，
触发 Hook 重新拉数据。手动刷新按钮（FR-109）直接调 `invalidateAll()` +
节流 10s。

**Rationale**:

- 写入频率极低（5~8 次/日）而用户在线时段分散，轮询是浪费。
- Supabase Realtime 的 Broadcast 通道不依赖数据库事件，payload 自由，适合
  承载"data-updated"这种轻量级通知。
- 宪法原则五 + FR-108 双重禁令，使得定时轮询不可选。

**Alternatives considered**:

- **Supabase Realtime Postgres Changes（订阅表变更）**：需要为每个表开启
  replication，RLS 在 Realtime 层要单独配置，出错面大；Broadcast 更适合
  "通知"型消息。
- **客户端 SSE / WebSocket 自建**：需要在 Vercel 之外再部署一个 WS 服务器，
  而 Supabase Realtime 免费层完全够用，不如直接用。

---

## R6. 定时调度：APScheduler + Asia/Shanghai 时区

**Decision**: Sealos Scheduler 使用 `APScheduler` + `BackgroundScheduler`
（asyncio 模式）在 `Asia/Shanghai` 时区触发：

| Job                    | Cron 表达式（CST）   | 说明 |
|-----------------------|---------------------|------|
| `stock_daily_midday`  | `30 11 * * 1-5`     | 午盘数据（FR-020） |
| `stock_daily_close`   | `15 15 * * 1-5`     | 尾盘数据（FR-020） |
| `news_fetch_with_stock_morning` | `35 11 * * 1-5` | 午盘资讯（FR-030a） |
| `news_fetch_with_stock_close`   | `20 15 * * 1-5` | 尾盘资讯（FR-030a） |
| `news_fetch_evening`  | `0 21 * * *`        | 21:00 资讯（FR-030b） |
| `news_fetch_dawn`     | `0 6 * * *`         | 06:00 资讯（FR-030c） |
| `ai_midday`           | `40 11 * * 1-5`     | 午评（FR-050，数据落库后 10 分钟内） |
| `ai_evening`          | `25 15 * * 1-5`     | 晚评（FR-050） |
| `ai_forecast`         | `10 21 * * *`       | 未来预测（FR-050） |
| `ai_forecast_dawn`    | `10 6 * * *`        | 未来预测（同 FR-050） |
| `sector_picks`        | `15 21 * * *`       | 预测推荐龙头（FR-070-072） |
| `news_summary`        | `5 21 * * *` 等      | 跟随每次新闻抓取 |
| `cleanup`             | `0 4 * * *`         | 60 日 / 7 日滚动清理（FR-022 / FR-031） |
| `calendar_refresh`    | `0 3 * * 0`         | 每周日 3am 刷新 5 市场交易日历（FR-120） |

每个 job 执行前先查 `market_calendar` 表：若当日 A 股休市，跳过 stock /
午评 / 晚评 job，保留 news / forecast job（FR-124 + Edge Cases"A 股休市
当日的 AI 调度"）。

**Rationale**:

- APScheduler 是 Python 生态最成熟的 cron 库，原生支持 asyncio，内存占用小。
- 在 Scheduler 内部做"休市日跳过"判定，避免跨服务协作。
- 任务之间按"数据→AI→广播"顺序编排（后项依赖前项），用 APScheduler 的
  `coalesce=True + max_instances=1` 保证不并发。

**Alternatives considered**:

- **Celery + Redis**：重型方案，还要额外部署 Redis + Celery Beat，本项目
  job 数量少、无分布式需求，过度。
- **Cron 容器（crond）**：写 shell 脚本触发 Python 命令，无 job 调度状态
  观测，出错难排查。

---

## R7. Drizzle 独占 schema + Python 只读写不建表

**Decision**: 所有数据库 schema 定义在 `lib/db/schema/*.ts`，通过
`drizzle-kit generate` + `drizzle-kit migrate` 管理。Python Scheduler 只通过
`supabase-py`（service_role key）对**已存在**的表做 CRUD，**严禁**
`CREATE TABLE / ALTER TABLE` 等 DDL；CI 里加一条 lint 校验 Scheduler 代码
不含 SQL DDL。

**Rationale**:

- 宪法「数据层」约束："任何 schema 变更 **必须** 作为 Drizzle migration
  提交到仓库"——这是唯一事实源。
- 两端共享 schema 时若任一端能建表，迟早会出现"本地 drizzle 定义 A 字段，
  线上被 Python 加了 B 字段"的分裂，排查成本极高。
- supabase-py 用 service_role key 走 PostgREST，天然是数据层操作，不越权
  做 DDL。

**Alternatives considered**:

- **两端各自维护 schema**：明确反模式，否决。
- **用 Python SQLAlchemy + Alembic 替代 Drizzle**：违反宪法。

---

## R8. DeepSeek LLM 调用：Vercel 用户触发 vs Sealos 批量生成

**Decision**: 两条并列路径：

- **Sealos Scheduler**（批量 / 后台）：午评 / 晚评 / 未来预测 / 新闻总结 /
  预测推荐。用 openai SDK 指向 DeepSeek 兼容端点（`base_url =
  https://api.deepseek.com/v1`），非 streaming（后台任务不在意 TTFB）。
- **Vercel Route Handler**（按需 / 前台）：个股介绍、个股分析（US7 / FR-090-
  092）。用 `openai` SDK + `stream: true`，Route Handler 返回 `ReadableStream`
  让前端用 SSE 渲染。Vercel Hobby 10s timeout 下足以传输完整响应（DeepSeek TTFB
  ~1s，流式输出边传边渲染，不占 timeout）。

共享 `lib/deepseek/prompts.ts` 中的 prompt 模板（Python 侧通过
`sealos/scheduler/clients/deepseek.py` 镜像同一组 prompt 字符串）。

**模型与上下文**（以 [官方定价页](https://api-docs.deepseek.com/quick_start/pricing)
为准，2026-05 更新）：

| 模型 ID | 用途建议 | 上下文 |
|---------|---------|--------|
| `deepseek-v4-flash` | 默认：午评 / 晚评 / 新闻 / 个股 / 预测 | **1M** |
| `deepseek-v4-pro` | 可选：追求更高质量的预测 | **1M** |
| `deepseek-chat` | 兼容别名 → v4-flash 非思考模式；**2026-07-24 弃用** | 1M |
| `deepseek-reasoner` | 兼容别名 → v4-flash 思考模式；**2026-07-24 弃用** | 1M |

本项目每日 prompt 规模（24h CLS ≈ 500 条 + 行情聚合）远低于 1M，未来预测
**无需** 再像 Kimi 时代那样刻意截断上下文。

**Rationale**:

- 按需调用放 Vercel 避免绕一圈 Sealos 的 HTTP 回调延迟。
- 批量调用放 Sealos 利用其无 timeout + 可重试的优势。
- Streaming 解决 Vercel Hobby 10s 限制（真正的 DeepSeek 响应耗时通常 3~8s，
  streaming 能在 1s 内开始输出）。

**Alternatives considered**:

- **所有 LLM 调用都在 Sealos**：用户按需调用要走 `Vercel → Sealos →
  DeepSeek → Sealos → Vercel` 两跳，增加延迟；否决。
- **所有 LLM 调用都在 Vercel**：Scheduler 需要 Vercel 提供一个"AI 生成"
  endpoint，但大量并发的批量调用会被 Vercel function 数限流；否决。

---

## R9. AkShare 接口精确选型

**Decision**（经在 AKShare 文档确认的稳定接口）：

| 数据需求              | AkShare 接口 | 调用位置 | 备注 |
|---------------------|-------------|---------|------|
| A 股当日快照         | `stock_zh_a_spot_em` | Scheduler | 东方财富数据源，全量约 5500 行 |
| A 股历史日线         | `stock_zh_a_hist` | Scheduler（回填 + 自选 5 日累计） | 按股票代码逐一调用，回填需并发 |
| 股票代码 → 名称搜索  | `stock_zh_a_spot_em` 结果内存搜索 / `stock_info_a_code_name` | Vercel Route Handler（轻量） | 本地搜索 |
| A 股交易日历         | `tool_trade_date_hist_sina` | Scheduler | 返回历史交易日列表 |
| 美 / 港 / 日 / 韩日历 | `pandas_market_calendars`（非 AkShare）| Scheduler | NYSE/HKEX/JPX/KRX |
| 财联社电报           | `stock_telegraph_cls` | Scheduler | 含 `pub_time` 字段 |
| 概念板块清单         | `stock_board_concept_name_em` | Scheduler | 东方财富，约 500 个概念 |
| 概念板块成分股       | `stock_board_concept_cons_em(symbol="板块名")` | Scheduler | |
| 概念板块指数行情     | `stock_board_concept_hist_em` | Scheduler | 用于计算超额收益（FR-072） |
| 期货行情（原油/黄金） | `futures_main_sina` 或 `futures_global_em` | Scheduler | 横向 Marquee 数据源 |
| 各国股市指数         | `index_global_em` / `stock_us_daily` | Scheduler | |

**Rationale**: 所有接口均来自 AkShare 官方文档且近半年有维护记录。概念板块
相关 `*_em`（东方财富源）比 `*_ths`（同花顺源）接口稳定性略高、响应更快。

**Alternatives considered**:

- **同花顺源 `stock_board_concept_*_ths`**：偶尔限频，备选项。Plan 阶段如
  发现 em 接口被限频，切换到 ths。
- **Tushare / BaoStock**：需要额外 token 且部分接口收费，AKShare 足够。

---

## R10. 筛选算法共享：Python ↔ TypeScript

**Decision**: 筛选算法（`launching-soon` / `main-uptrend`）的**权威实现**
写在 Python（`sealos/scheduler/screens/*.py`），结果落表 `stock_screen_results`
（按 `{trade_date, kind}` 主键）。Next.js 侧只读表，**不**在 Vercel 侧实现同一
算法。`lib/screens/*.ts` 仅暴露 TypeScript 类型定义 + 默认阈值常量，供
Vitest 测试时与 Python 端**对照常量值**是否同步（避免阈值漂移）。

**Rationale**:

- 算法跑在已经拥有"全量 60 日历史"的 Scheduler 侧最快（一次查询多股票的
  pandas DataFrame 远快于 Next.js 逐只查询）。
- 15:15 抓取完立即预计算结果并写表，Vercel 请求时 O(1) 读表，满足
  Assumptions"Dashboard 请求时直接读缓存"。
- 阈值常量（振幅 15%、单日 5%、回归斜率 0.3%、窗口收益 3%、正收益日 ≥ 3、
  单日回撤 ≥ -3%）同时在 Python 与 TS 中定义；CI 跑一条 `screens-consistency`
  test 读两端常量比对相等。

**Alternatives considered**:

- **Vercel Edge Function 现场计算**：60 日窗口扫 5500 只股票，单次数据库
  IO 及计算耗时可能 > 10s，超出 Serverless timeout；且每个用户请求都重跑
  是浪费。
- **Postgres stored procedure**：pgplsql 实现 log 回归、窗口统计较繁琐且
  难测试。

---

## R11. 虚拟滚动：`@tanstack/react-virtual`

**Decision**: 自选股数量 > 30 时启用虚拟滚动，使用
`@tanstack/react-virtual`（无头 primitive，与 `@dnd-kit` 组合简单）。

**Rationale**:

- 开箱即用、tree-shakeable、支持动态行高、不强绑定 UI 库；与 `@dnd-kit`
  组合的示例官方有文档。
- 保持宪法原则四"不引入额外 UI 库"——它是无头逻辑 hook，不提供任何视觉元素。

**Alternatives considered**:

- **`react-window` / `react-virtualized`**：老牌但 API 样板多，与 `@dnd-kit`
  的行拖拽交互集成麻烦。
- **不做虚拟滚动**：FR-062 硬要求 > 30 走虚拟滚动，不可跳过。

---

## R12. 拖拽排序：`@dnd-kit/core` + `@dnd-kit/sortable`

**Decision**: 自选股拖拽用 `@dnd-kit`，乐观 UI 立即更新 `watchlistSlice`，
放手后异步调 `PATCH /api/watchlist/reorder`，失败则 rollback + toast
（FR-011）。

**Rationale**:

- `@dnd-kit` 无头 + a11y 友好（键盘可拖拽）+ 支持触屏，覆盖宪法原则三
  "移动端桌面端一致"。
- 与 `react-virtual` 组合文档清晰。

**Alternatives considered**:

- **`react-beautiful-dnd`**：Atlassian 已停止维护。
- **原生 HTML5 Drag-and-Drop**：a11y 与触屏体验差。

---

## R13. 首页动态背景：3 组候选，常量开关

**Decision**: 在 `app/(public)/_components/` 下实现 3 组独立组件：

1. `dynamic-bg-particles.tsx` —— Magic UI `Particles` 组件封装
2. `dynamic-bg-gradient.tsx` —— Magic UI `AnimatedGradient` / `BorderBeam`
3. `dynamic-bg-candle.tsx` —— 自绘 K 线抽象动画（Canvas + requestAnimationFrame）

在 `lib/home-bg.ts` 导出一个常量 `HOME_BG_VARIANT: 'particles' | 'gradient'
| 'candle'`，`page.tsx` 根据常量渲染对应组件。切换只需改常量（FR-100）。
移动端下自动降级：`candle` 改为静态渐变以避免电量消耗。

**Rationale**:

- 符合 FR-100 "不少于 3 组可切换"且"切换不涉及业务代码"。
- 使用 `next/dynamic` 懒加载，首页 JS 包不会同时携带三组。

**Alternatives considered**:

- **在 env 变量里切换**：会让预览环境 / 生产环境不一致，难调试，否决。
- **用户端 UI 切换**：超出本期范围（见 Clarify Q4——Dashboard 完全固定布局）。

---

## R14. 多市场交易日历数据源

**Decision**:

- **A 股**：AKShare `tool_trade_date_hist_sina()` 返回从 1990 到未来的交易日
  列表，Scheduler 初次启动时全量同步，之后每周日 3am 增量刷新。
- **美 / 港 / 日 / 韩**：Python 库 `pandas-market-calendars` 内置 NYSE、HKEX、
  JPX、KRX 的 calendar 数据，覆盖未来 10+ 年。Scheduler 每周日刷新未来 90
  天数据写入 `market_calendar` 表。
- 所有判定统一以 `Asia/Shanghai` 所属自然日为准（FR-120 + Edge Case 时区边界）。

**Rationale**:

- AKShare 的 A 股日历是国内权威源；`pandas-market-calendars` 是 quant 社区
  事实标准，覆盖节假日与临时休市（如 911 后美股停市）。
- 两个数据源在 Scheduler 内合并为统一的 `(market, date, is_open)` 三元组
  写入同一张 `market_calendar` 表，上游差异被完全屏蔽。

**Alternatives considered**:

- **AKShare 某个接口同时覆盖美 / 港 / 日 / 韩**：目前没有统一接口，拒绝。
- **自写节假日规则**：维护成本高，错过一次节假日调整就会误判。

---

## R15. DeepSeek Prompt 工程：五类生成任务的差异化

**Decision**: `lib/deepseek/prompts.ts` 定义 6 个 prompt builder（与 Python 端
同名镜像）：

| 任务 | System Prompt 重点 | User Prompt 上下文 |
|------|------------------|------------------|
| `midday` 午评 | 资深 A 股交易员视角，简明、口语化、200~350 字，不做选股建议 | 当日午盘 5 大指数 + 涨跌家数 + 成交额 + 3 个最活跃板块 |
| `evening` 晚评 | 同上，语气更"复盘"，300~450 字 | 当日收盘全量指标 + 北向资金（若可得） |
| `forecast` 未来预测 | 明日 / 未来几日可能利好方向，不给具体标的 | 当日 + 过去 3 日收盘 + 最新 50 条 CLS 电报 + 国际 5 市场指数 |
| `news-summary` | 300 字以内摘要，列 3~5 条要闻，无广告 | 过去 24h 的 CLS 电报 |
| `stock-intro` 个股介绍 | 行业 / 主营 / 竞争优势三段式，不做投资建议 | 股票名称 + 代码 + 所属行业 + 主营（由搜索接口取） |
| `stock-analysis` 个股分析 | 近期走势 + 量价特征 + 风险三段式 | 过去 20 个交易日 K 线 + 所属概念 |

所有 prompt 在末尾统一附"此内容仅为公开数据整理，不构成投资建议"。
DeepSeek 回复 **必须** 是纯文本，不要求结构化输出，简化 schema 风险。

**Rationale**:

- Prompt 固定结构让下游的 FR-055 新鲜度判定 + FR-054 双时间戳呈现逻辑统一。
- 不要求 JSON 输出避免 DeepSeek 偶发的解析失败；纯文本更稳。
- 个股介绍缓存 30 天（见 spec 新鲜度阈值），与行业变动节奏匹配；个股分析
  1 交易日过期，与 K 线节奏一致。

**Alternatives considered**:

- **Structured output（JSON schema）**：适合预测推荐的板块 + 龙头结构化
  数据，但我们已经用代码侧算法挑龙头（FR-072），LLM 只输出板块清单即可，
  用普通行文后 regex 解析更鲁棒。

---

## R16. RLS 策略总览

**Decision**（详表见 data-model.md）：

| 表 | SELECT | INSERT / UPDATE / DELETE |
|----|--------|------------------------|
| `profiles` | 自己可读自己（`user_id = auth.uid()`） | 自己可 INSERT 一次 |
| `watchlist_items` | 自己可读自己 | 自己可增删改 |
| `stocks` / `stock_daily` / `stock_screen_results` | 登录用户可读 | 仅 service_role |
| `news_items` / `ai_artifacts` / `sector_picks` / `market_calendar` | 登录用户可读 | 仅 service_role |
| `audit_logs` / `long_lived_tokens` | 拒绝 anon / authenticated 直接访问 | 仅 service_role |

**Rationale**:

- 宪法要求"所有对客户端暴露的表必须定义 RLS"。
- Sealos Scheduler 用 service_role key 绕过 RLS 写入——这是其合法职责。
- 长期凭证 / 审计日志 RLS 全关，Vercel Route Handler 仅通过 service_role
  执行专用 RPC 操作它们。

---

## R17. 测试策略 4 层

**Decision**:

1. **Unit**（Vitest）：
   - 所有 Zustand slice action；
   - 所有业务 Hook（`useWatchlist`、`useAIArtifact` 等）；
   - 所有纯函数（FR-040 / FR-041 阈值验证、新鲜度比较、FR-008 账号名
     regex、`is-trading-day`）。
2. **Component / Interaction**（Vitest + @testing-library）：
   - 每个用户交互组件的 pending 态测试（宪法原则二硬要求）；
   - 虚拟滚动长列表的滚动帧率 smoke test；
   - Auth modal 在 MagicCard 容器中的键盘焦点管理（a11y）。
3. **Integration**（Vitest + Supabase CLI 起本地 Postgres）：
   - Route Handler × Drizzle × RLS 的端到端行为；
   - Supabase Realtime 事件发布 → 订阅本地回调。
4. **Scheduler**（pytest + respx）：
   - 每个 job 的完整流水线（AKTools mock → Supabase write → Realtime
     publish）；
   - 休市日跳过行为、回退到上一成功数据行为。

**Rationale**:

- 覆盖宪法原则二"最优先级"：业务逻辑函数 + Hook + Route Handler + Drizzle
  查询封装。
- MSW 在 Unit / Component 层一致拦截 Supabase / DeepSeek / AKTools HTTP。
- 不为 shadcn / Radix / Magic UI 写重复测试（原则二边界）。

---

## R18. 环境变量清单（供 quickstart.md 使用）

**Vercel 侧**（Next.js 应用）：

```env
# Supabase（由 Vercel-Supabase Integration 自动注入）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # ⚠ 仅 Server 侧使用，不得进入客户端 bundle

# 数据库（Drizzle 直连，Supabase Integration 也会注入）
POSTGRES_URL_NON_POOLING=
POSTGRES_URL=                      # pooled

# DeepSeek
DEEPSEEK_API_KEY=                      # 形如 sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# AKTools（Sealos 内网地址，仅从 Vercel 用于股票搜索兜底）
AKTOOLS_BASE_URL=                  # 形如 https://aktools-xxx.sealoshzh.site

# 邀请码（校验用，不暴露到客户端）
INVITE_CODE=violet-everGarden

# 站内 AI 功能的模型名
DEEPSEEK_MODEL_STOCK_INTRO=deepseek-v4-flash
DEEPSEEK_MODEL_STOCK_ANALYSIS=deepseek-v4-flash
```

**Sealos 侧**（Python Scheduler）：

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AKTOOLS_BASE_URL=http://aktools.ns-xxxxxx.svc.cluster.local:8080
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL_MIDDAY=deepseek-v4-flash
DEEPSEEK_MODEL_EVENING=deepseek-v4-flash
DEEPSEEK_MODEL_FORECAST=deepseek-v4-flash
DEEPSEEK_MODEL_NEWS_SUMMARY=deepseek-v4-flash
SCHEDULER_AUTH_TOKEN=              # 自己生成的 X-Scheduler-Token
TZ=Asia/Shanghai
```

`SUPABASE_SERVICE_ROLE_KEY` 在 Scheduler 与 Vercel 都会用到——但
Scheduler 仅在 Sealos 容器内部可见；Vercel 侧用 Next.js 的约定前缀
规则（无 `NEXT_PUBLIC_` 前缀的变量不会进入客户端 bundle）保护。

---

## 决策索引

| # | 主题 | 关键决定 |
|---|------|--------|
| R1 | 整体架构 | Vercel + Sealos 双层，共享 Supabase |
| R2 | Sealos 部署 | AKTools + Scheduler 分两个 App |
| R3 | 认证 | Supabase Auth + 真实邮箱注册登录 |
| R4 | 客户端状态 | Zustand 5 slice + persist partialize |
| R5 | 数据刷新 | Supabase Realtime Broadcast + 手动刷新 |
| R6 | 调度 | APScheduler + Asia/Shanghai + 休市日跳过 |
| R7 | schema 管理 | Drizzle 独占，Python 只读写 |
| R8 | LLM 调用 | 按需走 Vercel 流式，批量走 Sealos |
| R9 | AkShare 接口 | 东方财富为主，同花顺备选 |
| R10 | 筛选算法位置 | Python 权威实现，TS 仅类型 + 阈值常量 |
| R11 | 虚拟滚动 | `@tanstack/react-virtual` |
| R12 | 拖拽 | `@dnd-kit` |
| R13 | 动态背景 | 3 组候选 + 常量切换 |
| R14 | 交易日历 | AkShare（CN）+ pandas-market-calendars（其它 4 市场） |
| R15 | DeepSeek prompt | 6 个 prompt builder，文本输出 |
| R16 | RLS | 三档：登录可读 / 自己读写 / service_role |
| R17 | 测试策略 | 4 层：unit/component/integration/scheduler |
| R18 | 环境变量 | Vercel + Sealos 两套独立清单 |

---

## 未完全解决 → 需要用户介入的事项（在 quickstart.md 中逐步指引）

1. **申请 DeepSeek API key**：到 https://platform.deepseek.com 注册账号并创建
   API key，按平台定价充值（新账号通常有少量免费额度）。
2. **创建 Vercel 账号与项目**：从 Vercel Dashboard 导入本仓库（GitHub），
   框架自动识别为 Next.js。
3. **通过 Vercel-Supabase Integration 创建 Supabase 数据库**：在 Vercel 项目
   Dashboard → Integrations → Supabase → Install → 新建项目。此步会自动注入
   所有 `SUPABASE_*` 环境变量。
4. **注册 Sealos 账号并部署 AKTools + Scheduler**：
   - App Launchpad 创建 `aktools` App（镜像 `akfamily/aktools:latest`）
   - App Launchpad 创建 `scheduler` App（自建镜像，需本地 build & push 到
     Sealos 镜像仓库或 Docker Hub）
5. **运行首次数据库迁移与历史回填**：在本地跑 `pnpm db:migrate`，再在 Sealos
   Scheduler 上触发 `POST /trigger/initial-backfill`。

以上步骤的详细操作指引与截图 / 代码块见 `quickstart.md`。
