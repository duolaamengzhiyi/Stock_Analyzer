# Implementation Plan: Stock Analyzer Platform — Initialization

**Branch**: `001-initialization` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-initialization/spec.md`

## Summary

本 feature 是整个产品的"首版完整初始化"——交付一个基于 Next.js App Router 的
股票数据分析网站，含：邀请码受控注册登录、自选股管理、Dashboard（启动在即 /
主升浪 / 自选股 / 午评 / 晚评 / 未来预测 / 预测推荐 / 多市场休市状态）、个股
AI 弹出菜单、24 小时新闻聚合 + AI 总结。

技术方案上采用**双层架构**：

1. **Vercel（Next.js App Router）**：承载所有用户请求——页面渲染（RSC）、
   认证、自选股管理、手动 / Realtime 触发的数据读取、用户按需触发的 AI
   调用（个股介绍 / 分析）。
2. **Sealos（Python FastAPI Scheduler）**：承载所有后台定时任务——拉 AKTools
   原始数据、写入 Supabase、调用 DeepSeek 生成午评 / 晚评 / 未来预测 / 新闻
   总结、通过 Supabase Realtime 广播 `data-updated` 事件给 Vercel 前端。

两层之间**唯一的耦合面**是 Supabase Postgres（由 Drizzle 独占 schema）和
Supabase Realtime（事件频道）。用户不会有任何"Vercel 页面卡住等 Sealos 回调"
的体验——Vercel 只读 Supabase，Sealos 只写 Supabase。

## Technical Context

**Language/Version**: TypeScript 5.6 (Vercel Next.js 侧 strict 模式) + Python 3.12 (Sealos Scheduler 侧)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Tailwind CSS 3.4, shadcn/ui, Magic UI (MagicCard / Number Ticker / Marquee / Bento Grid), Zustand 5, Drizzle ORM, @supabase/supabase-js, @supabase/ssr (SSR 会话), next-nprogress-bar, @dnd-kit/core & @dnd-kit/sortable (自选股拖拽), @tanstack/react-virtual (虚拟滚动), lucide-react (图标)；Python 侧：FastAPI, httpx, supabase-py, apscheduler, openai (指向 DeepSeek 兼容端点)
**Storage**: Supabase Postgres（经 Vercel ↔ Supabase Integration 创建，所有 schema 由 Drizzle migration 管理）+ Supabase Auth（真实邮箱注册登录，开启 Confirm email）+ Supabase Realtime（频道 `data-updated`）
**Testing**: Vitest + @testing-library/react + MSW（HTTP mock）+ Vitest 原生测 Zustand slice；Python 侧 pytest + respx（httpx mock）
**Target Platform**: Web（桌面 Chrome / Safari / Edge 近两年版本；移动端 iOS Safari 16+ / Chrome Android；最小断点 360px）
**Project Type**: Web application（Next.js 单仓前后端一体）+ 独立 Python Scheduler（`sealos/scheduler/`，单独 Docker 化）
**Performance Goals**:

- Dashboard 冷启动首屏可见 ≤ 2s（SC-003）
- 跨路由从缓存复现 ≤ 200ms（SC-004）
- 交互首帧反馈 ≤ 100ms（SC-005 / 宪法原则五）
- Realtime 事件到板块局部刷新 ≤ 3s（SC-006）
- 定时抓取成功到落库 P95 ≤ 5min（SC-010）
- 自选股虚拟滚动滚动帧率 ≥ 50 fps（US4 AS6）

**Constraints**:

- Vercel Serverless Function timeout：Hobby 10s / Pro 60s（DeepSeek 按需调用需用
  streaming 降低 TTFB）
- Supabase Free 层：500 MB 数据 + 2 GB 月流量 + 50k MAU + pg_cron 支持。本项目
  数据规模 ≤ 60MB，流量估算足够用 Free；若用户量起来改 Pro。
- DeepSeek 上下文窗口：本期统一使用官方 API 模型 `deepseek-v4-pro`，
  支持 **1M token** 上下文（见 [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)）。
  午评 / 晚评 / 新闻总结 / 未来预测 / 个股介绍 / 个股分析 六类产物均默认走
  `deepseek-v4-pro`；未来预测可聚合 24h 全量 CLS 电报 + 多日行情，无需像旧版
  Kimi 那样刻意压缩到 128k。兼容别名 `deepseek-chat` / `deepseek-reasoner`
  将于 2026-07-24 弃用，本仓库实现侧不再写这两个 ID。
- Sealos 实例：调度器作为单实例长驻，允许 256MB~512MB 内存 / 0.25 vCPU，
  单实例完成所有定时任务（无需横向扩展）。
- 所有客户端代码 **禁止** 引入数据层定时轮询（FR-108 硬约束）。

**Scale/Scope**:

- 股票数据：约 5,500 只 A 股 × 60 交易日 ≈ 33 万条 `stock_daily` 行
- 新闻数据：每日约 500 条 × 7 日 ≈ 3,500 条 `news_items` 行
- AI 产物：每日约 4~8 条永久保留
- 用户规模：MVP 期预估 ≤ 100（邀请码小圈子），无高并发压力
- 代码规模：Next.js + Scheduler 合计估算 15k~25k LOC；UI 组件约 40~60 个

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

本 plan 按宪法 v1.2.0 七条原则逐条评估：

### 原则一 — 组件与样式复用优先 → ✅ 通过

- 所有通用 UI 原语集中在 `components/ui/`（来自 shadcn/ui）
- 变体通过 `cva` / `tailwind-variants` 管理（如 `stockChangeBadge` 红绿色变体）
- 业务 Hook 放 `hooks/`（`useAuth`、`useWatchlist`、`useAIArtifact` 等），
  不在组件内重复网络逻辑

### 原则二 — 测试驱动开发（不可妥协） → ✅ 通过

- 每个 Zustand slice 的 action 附带 Vitest 单测，直接断言 `getState()`
- 业务 Hook 与 Route Handler 单测覆盖；MSW 拦截 Supabase / DeepSeek / AKTools HTTP
- 交互组件按原则二"最优先级"清单写 pending 态测试（例如拖拽放手瞬间的
  乐观 UI、AI 菜单呼出首帧、手动刷新按钮的 disabled 态）
- Python Scheduler 用 pytest + respx mock httpx 调用，测抓取→落库→广播的
  端到端流水线

### 原则三 — 移动端与桌面端体验一致 → ✅ 通过

- 所有页面 mobile-first：`sm`（≤640px）单列、`lg`（≥1024px）Bento Grid
- 侧边导航移动端改抽屉（US11）；Dashboard 卡片在 sm 下改为垂直栈
- 无依赖 hover 的关键交互（个股菜单既支持点击也支持长按）

### 原则四 — 受控的组件库（shadcn + Magic UI） → ✅ 通过

- 注册弹窗用 MagicCard 作为容器（US1 / FR-001）
- Dashboard 指数数字用 Number Ticker（FR-102）
- 期货价格横向 Marquee（FR-103）；领涨行业竖向 Marquee（FR-104）
- Bento Grid 整体布局（FR-101）
- 其余全部 shadcn/ui，未引入第三方 UI 库（除 `@dnd-kit` 纯拖拽库与
  `@tanstack/react-virtual` 纯虚拟滚动库，均非 UI 组件库，属于交互 primitive）

### 原则五 — 性能与响应感知 → ✅ 通过

- 默认 RSC，仅交互组件加 `"use client"`
- 数据抓取边界全部 `<Suspense>` + `loading.tsx` + 骨架屏
- 路由切换使用 `next-nprogress-bar` 顶部进度条（对应宪法原则五 (d)）
- 按钮 / 表单在异步交互时显示 pending 态（`disabled` + spinner）
- Supabase Realtime 推送触发**板块级**局部刷新，不整页重载
- `next/image` + `next/dynamic`（首页动态背景作为 client-only 动态加载）

### 原则六 — 关键步骤注释（面向新手） → ✅ 通过

- 所有 Server/Client 边界（`"use client"`、Server Action、Route Handler）
  顶部一行注释说明运行环境与身份校验假设
- 筛选算法模块（`sealos/scheduler/screens/`，单侧 Python 实现）每个函数说明窗口、阈值、来自哪条 FR
- Scheduler 里每个 job 顶部注释触发时刻、失败处理、下游影响

### 原则七 — 客户端状态与 Zustand 统一管理 → ✅ 通过

- 唯一根 store：`stores/useAppStore.ts`，组合 5 个 slice：
  `authSlice` / `watchlistSlice` / `cacheSlice` / `uiSlice` / `realtimeSlice`
- 请求结果缓存统一经 `cacheSlice`：key 形如 `screens:launching-soon:{date}`、
  `watchlist:{userId}` 等，TTL 由各 feature 定义
- `persist` + `partialize`：仅持久化 `uiSlice`（主题 / 侧栏 / 横幅关闭）和
  `watchlistSlice.draft`（避免用户误操作丢失）
- 所有 slice action 附 Vitest 单测；组件订阅必须用细粒度 selector

**结论**：Constitution Check **PASS**。无违规，**不需要** Complexity
Tracking 登记。

## Project Structure

### Documentation (this feature)

```text
specs/001-initialization/
├── plan.md              # 本文件
├── research.md          # Phase 0 产出：所有技术决策 + 拒绝替代方案
├── data-model.md        # Phase 1 产出：Drizzle schema + RLS 策略
├── quickstart.md        # Phase 1 产出：给初学者的完整操作指引（★ 用户重点看）
├── contracts/           # Phase 1 产出：API 契约 + Sealos 调度契约
│   ├── web-api.md       # Next.js Route Handler 契约
│   ├── sealos-jobs.md   # Scheduler 任务契约（输入 / 输出 / 失败处理）
│   └── realtime-events.md  # Supabase Realtime 事件 payload 契约
├── checklists/
│   └── requirements.md  # /speckit.specify 阶段产出的质量清单
└── tasks.md             # Phase 2 产出（由后续 /speckit.tasks 生成）
```

### Source Code (repository root)

本项目是 **Web application + 独立 Scheduler**，采用 Next.js 单仓（monorepo
外观但未启用 workspace，Sealos Scheduler 作为兄弟目录独立打包）：

```text
# ────────── Vercel (Next.js) ──────────
app/
├── (public)/              # 公开路由组（无需登录）
│   ├── layout.tsx
│   ├── page.tsx           # 首页：动态背景 + 注册登录入口
│   └── _components/
│       ├── dynamic-bg-particles.tsx     # ≥ 3 组动态背景（FR-100）
│       ├── dynamic-bg-gradient.tsx
│       └── dynamic-bg-candle.tsx
├── (auth)/                # 认证模态路由组
│   └── _modals/
│       └── auth-modal.tsx                # MagicCard 弹窗（FR-001）
├── (app)/                 # 登录后路由组
│   ├── layout.tsx                        # 侧边栏 + 路由拦截
│   ├── dashboard/
│   │   ├── page.tsx                      # Bento Grid 主布局（FR-101）
│   │   ├── loading.tsx                   # Skeleton 骨架屏
│   │   └── _components/
│   │       ├── market-status-card.tsx    # 5 市场开休市（US12 / FR-123）
│   │       ├── holiday-banner.tsx        # A 股休市横幅（FR-121）
│   │       ├── ai-commentary-card.tsx    # 午评 / 晚评 / 未来预测（FR-050+054+055）
│   │       ├── launching-soon-list.tsx   # 启动在即（US3 / FR-040）
│   │       ├── main-uptrend-list.tsx     # 主升浪（US3 / FR-041）
│   │       ├── watchlist-widget.tsx      # 自选股板块（虚拟滚动 / FR-062）
│   │       ├── sector-picks-card.tsx     # 预测推荐（US8 / FR-070-072）
│   │       ├── indices-ticker.tsx        # Number Ticker 指数（FR-102）
│   │       ├── futures-marquee.tsx       # 横向 Marquee（FR-103）
│   │       ├── industry-marquee.tsx      # 竖向 Marquee（FR-104）
│   │       ├── stock-action-menu.tsx     # 个股弹出菜单（US7 / FR-090-093）
│   │       ├── stock-ai-dialog.tsx       # AI 结果弹窗
│   │       └── manual-refresh-button.tsx # 手动刷新（FR-109）
│   ├── watchlist/
│   │   ├── page.tsx                      # 自选管理（搜索 + 拖拽 + 删除）
│   │   └── _components/
│   │       ├── stock-search.tsx
│   │       ├── watchlist-sortable.tsx    # @dnd-kit + react-virtual
│   │       └── too-many-warning.tsx      # ≥ 200 软提示（FR-014）
│   └── news/
│       ├── page.tsx                      # 24h 新闻聚合 + AI 总结（US6）
│       └── _components/
│           ├── news-ai-summary.tsx
│           └── news-list.tsx
├── auth/
│   └── callback/route.ts                 # Supabase 邮箱确认回跳，交换 code 后建 session
├── api/                   # Route Handlers（服务端）
│   ├── auth/
│   │   ├── register/route.ts             # 邀请码 + 真实邮箱 + 账号名 + 密码（FR-002, FR-008, FR-009）
│   │   ├── login/route.ts                # 含 7 天免登录（FR-004, FR-007）
│   │   └── logout/route.ts
│   ├── watchlist/
│   │   ├── route.ts                      # GET / POST
│   │   ├── [code]/route.ts               # DELETE
│   │   └── reorder/route.ts              # PATCH
│   ├── search/
│   │   └── stocks/route.ts               # 股票代码 / 名称搜索（FR-010）
│   ├── screens/
│   │   ├── launching-soon/route.ts       # 读 stock_screen_results
│   │   └── main-uptrend/route.ts
│   ├── ai/
│   │   ├── stock-intro/[code]/route.ts   # 个股介绍（用户按需 / FR-090-092）
│   │   └── stock-analysis/[code]/route.ts
│   ├── dashboard/
│   │   ├── indices/route.ts              # 指数 + 涨跌家数
│   │   ├── market-status/route.ts        # 5 市场开休市（FR-120 / FR-123）
│   │   └── refresh/route.ts              # 手动刷新（FR-109 节流）
│   └── news/route.ts                     # 24h 新闻列表（US6）
├── middleware.ts                         # 路由拦截 + Supabase session 刷新（FR-005）
└── globals.css                           # Tailwind 入口 + 变量

components/
├── ui/                    # shadcn/ui 生成的通用原语（Button / Input / Dialog / ...）
├── magic/                 # Magic UI 的薄封装（MagicCard / NumberTicker / Marquee / BentoGrid）
└── shared/                # 跨页面复用的业务原子（StockBadge / ChangePercent / SkeletonRow）

lib/
├── db/
│   ├── schema/            # Drizzle schema 按实体分文件（见 data-model.md）
│   │   ├── profiles.ts
│   │   ├── stocks.ts
│   │   ├── stock-daily.ts
│   │   ├── watchlist.ts
│   │   ├── ai-artifacts.ts
│   │   ├── news.ts
│   │   ├── sector-picks.ts
│   │   ├── market-calendar.ts
│   │   └── index.ts
│   ├── migrations/        # Drizzle 自动生成的 SQL 迁移
│   └── index.ts           # Drizzle client（指向 Supabase Postgres）
├── supabase/
│   ├── client.ts          # 浏览器端 client
│   ├── server.ts          # Server Component / Route Handler client
│   ├── middleware.ts      # middleware 中的 session 刷新 helper
│   └── auth.ts            # 注册 / 登录（真实邮箱 + Supabase Auth）
├── deepseek/
│   ├── client.ts          # 指向 DeepSeek OpenAI 兼容端点
│   └── prompts.ts         # midday / evening / forecast / news-summary / stock-intro / stock-analysis prompt 模板
├── market-calendar/
│   ├── is-trading-day.ts  # (market, date) → boolean，读 market_calendar 表
│   └── last-trading-day.ts
# 注：筛选算法仅在 Sealos Python 侧实现（见 sealos/scheduler/screens/）；
# Vercel 端只读 stock_screen_results 表，不再保留 lib/screens/。
├── realtime/
│   ├── channels.ts        # 频道名常量 + payload 类型
│   └── subscribe.ts       # 前端订阅封装
└── utils/

stores/
├── useAppStore.ts         # 根 store（combine 所有 slice）
├── slices/
│   ├── authSlice.ts
│   ├── watchlistSlice.ts
│   ├── cacheSlice.ts      # 请求结果缓存（FR-107 / 原则七）
│   ├── uiSlice.ts         # 侧栏 / 主题 / 横幅关闭
│   └── realtimeSlice.ts   # Supabase Realtime 连接状态 + 断连重连（FR-111）
└── selectors/             # 细粒度 selector

hooks/
├── useAuth.ts
├── useSupabaseSession.ts
├── useWatchlist.ts
├── useStockScreens.ts
├── useAIArtifact.ts
├── useMarketStatus.ts
├── useHolidayBanner.ts    # 自然日边界 localStorage 逻辑（FR-121）
└── useRealtimeChannel.ts  # 订阅 data-updated 并局部刷新（FR-106 / FR-107）

tests/
├── unit/
├── integration/           # Route Handler + DB 集成测试（用 Supabase CLI 起本地 Postgres）
└── setup/                 # MSW handlers / Vitest setup

drizzle.config.ts          # Drizzle 配置（指向 Supabase）
next.config.ts
tailwind.config.ts
vitest.config.ts
package.json
tsconfig.json
.env.example               # 环境变量样板

# ────────── Sealos (Python Scheduler) ──────────
sealos/
└── scheduler/
    ├── main.py            # FastAPI + APScheduler 入口
    ├── jobs/
    │   ├── stock_daily.py     # 11:30 / 15:15 抓股票（FR-020 / FR-021）
    │   ├── news_fetch.py      # 随股票 + 21:00 + 06:00 抓新闻（FR-030）
    │   ├── ai_generate.py     # 午评 / 晚评 / 未来预测（FR-050）
    │   ├── news_summary.py    # 新闻 AI 总结（FR-080）
    │   ├── sector_picks.py    # 预测推荐（FR-070~072）
    │   ├── initial_backfill.py # 首日 60 日回填（FR-024）
    │   ├── calendar_refresh.py # 5 市场交易日历刷新（FR-120）
    │   └── cleanup.py         # 60 日 / 7 日滚动清理（FR-022 / FR-031）
    ├── clients/
    │   ├── aktools.py         # Sealos 内部调用 AKTools HTTP
    │   ├── supabase.py        # supabase-py 封装（service_role，仅服务端）
    │   └── deepseek.py        # DeepSeek OpenAI 兼容 SDK 封装
    ├── screens/
    │   ├── launching_soon.py  # FR-040 算法 Python 实现（与 lib/screens 逻辑一致）
    │   └── main_uptrend.py    # FR-041
    ├── realtime/
    │   └── publish.py         # 通过 supabase-py 广播 data-updated
    ├── config.py              # 从环境变量读取所有 URL/Key
    ├── requirements.txt
    ├── Dockerfile
    ├── sealos-deploy.yml      # Sealos App Launchpad 的 YAML（见 quickstart.md）
    └── README.md              # Sealos 上 build + 运行的说明
```

**Structure Decision**: 采用 Web 应用（Next.js App Router 单仓）+ 独立 Python
Scheduler（`sealos/scheduler/` 子目录）。两者共用 Supabase 作为唯一 schema
数据源，schema 由 Drizzle 独占管理——Python 侧仅读写 Drizzle 已建好的表，
**严禁** 在 Scheduler 里 `CREATE TABLE`（避免 schema 分裂）。

前端侧的路由组划分（`(public)` / `(auth)` / `(app)`）确保登录拦截与未登录
公开首页的 layout 互不干扰。

## Complexity Tracking

> *没有违反宪法，本节为空。*

所有宪法原则均通过 Constitution Check 评估。双层架构（Vercel + Sealos）本身
不是"偏离"——宪法明确允许 Supabase Realtime 与数据库跨服务共享，且 Scheduler
不是 Next.js Server Component 的组成部分，不受"Server Component 访问数据库
必须走 Drizzle"的约束。Scheduler 读写 Supabase 时通过 supabase-py 走 REST /
Realtime，**schema 仍由 Drizzle migration 管理**，一致性通过 CI 校验"线上表
结构 = migrations 的累计结果"保证。

## Post-Design Constitution Re-check

*在 Phase 1（data-model.md / contracts/ / quickstart.md）产出后重新评估。*

**结论**: **PASS**，无新增违规。

| 原则 | 重检结论 |
|------|---------|
| 一、组件与样式复用 | Contracts 未新增 UI 原语，shadcn/ui 集中策略不变 |
| 二、测试驱动 | research.md R17 明确 4 层测试策略（unit / component / integration / scheduler），每个 contract 端点都对应可测试行为 |
| 三、移动 / 桌面一致 | UI 层未引入新的破坏响应式的组件 |
| 四、受控组件库 | contracts 未引入任何非 shadcn / Magic UI / 无头逻辑 primitive 之外的第三方组件库 |
| 五、性能与响应感知 | Realtime Broadcast + 禁止轮询（FR-108）+ SSE 流式 AI + 节流手动刷新，全部由 contracts 固化 |
| 六、关键步骤注释 | plan 指定了"所有 Server/Client 边界顶部注释"的原则，实现阶段将由 `/speckit-tasks` 落到具体任务 |
| 七、Zustand 统一管理 | data-model 明确写入路径严格对齐（Vercel/Sealos 分别持有哪些表），客户端请求结果缓存走 `cacheSlice`；realtime 事件 → invalidate → 重拉 的流程与 FR-107 完全吻合 |

**Service role key 的安全面重检**: Vercel Route Handler 使用
`SUPABASE_SERVICE_ROLE_KEY` 的场景（仅 Server 侧，如查询邀请码、插入
`ai_artifacts`、签发 `long_lived_tokens`）已明确**不**通过 `NEXT_PUBLIC_`
前缀暴露；Sealos Scheduler 的 key 在容器环境变量中，不跨网络到客户端。符合
宪法「密钥与配置」条款。

**Complexity Tracking 仍为空**：无需登记偏离。
