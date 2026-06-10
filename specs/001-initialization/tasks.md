# Tasks: Stock Analyzer Platform — Initialization

**Feature Branch**: `001-initialization`
**Input**: Design documents from `/specs/001-initialization/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: 包含。理由：宪法 v1.2.0 原则二「测试驱动开发（不可妥协）」明确为硬约束，plan.md 已在 Constitution Check 通过该项；spec.md 各 User Story 也均给出 Independent Test 清单。每个故事按"Tests → Models/算法 → Service/API → UI"顺序推进。

**Organization**: 任务按 12 个 User Story 分组，每组可独立完成与测试；Phase 1（Setup）与 Phase 2（Foundational）为所有故事共享前置条件。

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可与同 phase 其它 [P] 任务并行（不同文件、无前置依赖）
- **[Story]**: 该任务所属 User Story（US1…US12），仅 Phase 3+ 出现
- 每条任务带明确的相对/绝对路径

---

## Path Conventions

仓库为 **Next.js 单仓 + 独立 Python Scheduler**（plan.md "Project Structure"）：

- Vercel/Next.js 侧：`app/`、`components/`、`lib/`、`stores/`、`hooks/`、`tests/`，根目录运行
- Sealos 侧：`sealos/scheduler/`，独立 `pyproject.toml` + `Dockerfile`
- Drizzle schema：`lib/db/schema/*.ts`；migration：`lib/db/migrations/`

---

## Phase 1: Setup（共享基础设施）

**Purpose**: Next.js + Sealos 双骨架初始化、依赖安装、工具链配置。Vercel 项目、Supabase Integration、`.env.local` 已在 quickstart [3]–[5.1] 完成（外部前置条件，不在任务范围内）。

- [X] T001 在仓库根目录用 `pnpm create next-app@latest .` 初始化 Next.js 15（App Router、TS strict、Tailwind 3.4），保留现有 `specs/`、`.specify/`、`.gitignore` 等不被覆盖
- [X] T002 [P] 安装核心运行时依赖：`pnpm add next@15 react@19 react-dom@19 zustand drizzle-orm postgres @supabase/supabase-js @supabase/ssr next-nprogress-bar @dnd-kit/core @dnd-kit/sortable @tanstack/react-virtual lucide-react zod`
- [X] T003 [P] 安装开发依赖：`pnpm add -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom msw eslint @typescript-eslint/eslint-plugin prettier`
- [X] T004 [P] 配置 `tsconfig.json` 启用 strict 模式，paths 别名 `@/*` → 项目根
- [X] T005 [P] 初始化 shadcn/ui：`pnpm dlx shadcn@latest init`，组件目录 `components/ui/`
- [X] T006 [P] 创建 `tailwind.config.ts` 与 `app/globals.css`，注入 shadcn 主题变量与 `涨红跌绿` 语义色 token（FR-043 / FR-104）
- [X] T007 [P] 创建 ESLint 配置 `eslint.config.mjs`，含自定义规则禁止 `setInterval` / `refreshInterval` / `useSWR.refreshInterval`（FR-108 静态约束，落实到 lint）
- [X] T008 [P] 创建 `.prettierrc` 与 `.editorconfig`，统一格式
- [X] T009 创建 `drizzle.config.ts`（指向 `POSTGRES_URL_NON_POOLING`，schema 路径 `lib/db/schema/*.ts`，out `lib/db/migrations`）
- [X] T010 [P] 创建 `vitest.config.ts` + `tests/setup.ts` 接入 jsdom + MSW，`pnpm test` 脚本入口
- [X] T011 [P] 创建 `.env.example` 列出 SUPABASE/POSTGRES/DEEPSEEK/AKTOOLS 全部变量名（仅占位、不含值）
- [X] T012 创建 `package.json` scripts：`dev`、`build`、`start`、`lint`、`test`、`db:generate`、`db:migrate`、`db:push`、`db:studio`
- [X] T013 [P] 在仓库根创建 `sealos/scheduler/` 目录，写 `pyproject.toml`（FastAPI、httpx、supabase-py、apscheduler、openai、pandas、numpy）+ `requirements.txt` 同步
- [X] T014 [P] 创建 `sealos/scheduler/Dockerfile`（python:3.12-slim, 安装 deps, `CMD ["uvicorn", "main:app"]`）
- [X] T015 [P] 创建 `sealos/scheduler/sealos-deploy.yml` Sealos App Launchpad 配置骨架（参考 quickstart [6.3]）
- [X] T016 [P] 创建 `sealos/scheduler/pytest.ini` + `tests/conftest.py`，接入 respx mock httpx

**Checkpoint**: 双骨架成型，`pnpm dev` 能起空白 Next，`docker build sealos/scheduler/` 能构建。

---

## Phase 2: Foundational（阻塞所有 User Story）

**Purpose**: Drizzle schema + RLS + Supabase client + Zustand 根 store + 路由拦截壳 + 共享 UI 原语 + Realtime/Calendar 工具。**所有 12 张表 schema 必须先落，否则 US1 之后没有数据底座**。

- [X] T017 [P] 创建 `lib/db/schema/profiles.ts`（data-model.md §1）
- [X] T018 [P] 创建 `lib/db/schema/long-lived-tokens.ts`（§2）
- [X] T019 [P] 创建 `lib/db/schema/invite-codes.ts`（§3）
- [X] T020 [P] 创建 `lib/db/schema/stocks.ts`（§4）
- [X] T021 [P] 创建 `lib/db/schema/stock-daily.ts`（§5）
- [X] T022 [P] 创建 `lib/db/schema/stock-screen-results.ts`（§6）
- [X] T023 [P] 创建 `lib/db/schema/watchlist-items.ts`（§7）
- [X] T024 [P] 创建 `lib/db/schema/news-items.ts`（§8）
- [X] T025 [P] 创建 `lib/db/schema/ai-artifacts.ts`（§9）
- [X] T026 [P] 创建 `lib/db/schema/sector-picks.ts`（§10）
- [X] T027 [P] 创建 `lib/db/schema/market-calendar.ts`（§11）
- [X] T028 [P] 创建 `lib/db/schema/audit-logs.ts`（§12）
- [X] T029 创建 `lib/db/schema/index.ts` 汇总导出（依赖 T017–T028）
- [X] T030 创建 `lib/db/index.ts`（postgres-js + drizzle 客户端，使用 `POSTGRES_URL`）
- [X] T031 执行 `pnpm db:generate` 派生首版 SQL migration 到 `lib/db/migrations/0000_*.sql`（依赖 T029）
- [X] T032 在 `lib/db/migrations/0001_rls_policies.sql` 手写 RLS 策略（按 data-model.md 各表 RLS 段）
- [X] T033 在 `lib/db/migrations/0002_seed_invite_codes.sql` 写入种子 `INSERT INTO invite_codes(code, reusable) VALUES ('violet-everGarden', true)`
- [X] T034 执行 `pnpm db:migrate` 应用全部 migration 到 Supabase（依赖 T031–T033）
- [X] T035 [P] 创建 `lib/supabase/client.ts`（浏览器 anon client）
- [X] T036 [P] 创建 `lib/supabase/server.ts`（@supabase/ssr Server Component / Route Handler client）
- [X] T037 [P] 创建 `lib/supabase/middleware.ts`（session 刷新 helper）
- [X] T038 [P] 创建 `lib/supabase/admin.ts`（service_role client，仅服务端可用）
- [X] T039 创建 `middleware.ts` 在仓库根，引用 `lib/supabase/middleware.ts`，框架性实现"未登录访问受保护路由 → 重定向 `/?redirect=…`"（FR-005 占位，US1 phase 内补完）
- [X] T040 [P] 创建 `stores/useAppStore.ts` 根 store（combine slices）
- [X] T041 [P] 创建 `stores/slices/cacheSlice.ts`（key+TTL 通用缓存，FR-061 / FR-107）
- [X] T042 [P] 创建 `stores/slices/uiSlice.ts`（侧栏、主题、横幅关闭，含 persist+partialize）
- [X] T043 [P] 创建 `stores/slices/realtimeSlice.ts` 骨架（连接状态机，US 各 phase 内补 reducer）
- [X] T044 [P] 创建 `lib/realtime/channels.ts` 频道名常量 + payload TS 类型（contracts/realtime-events.md "事件枚举"）
- [X] T045 [P] 创建 `lib/market-calendar/is-trading-day.ts` 与 `last-trading-day.ts`（读 `market_calendar` 表）
- [X] T046 [P] 用 shadcn CLI 添加共用原语：Button / Input / Dialog / Toast / Skeleton / Tooltip / Popover / DropdownMenu / Form 到 `components/ui/`
- [X] T047 [P] 创建 `components/magic/MagicCard.tsx` / `NumberTicker.tsx` / `Marquee.tsx` / `BentoGrid.tsx` 薄封装（Magic UI MCP）
- [X] T048 [P] 创建 `components/shared/StockBadge.tsx` + `ChangePercent.tsx`（涨红跌绿、FR-043）
- [X] T049 [P] 创建 `lib/utils/cn.ts`（clsx + tailwind-merge）与 `lib/utils/zod-schemas.ts`（账号名/密码/股票代码 schema）
- [X] T050 [P] 创建 `sealos/scheduler/main.py` FastAPI 入口 + APScheduler 配置（Asia/Shanghai 时区）
- [X] T051 [P] 创建 `sealos/scheduler/clients/supabase.py`（supabase-py service_role 封装）
- [X] T052 [P] 创建 `sealos/scheduler/clients/aktools.py`（httpx → Sealos AKTools URL 封装）
- [X] T053 [P] 创建 `sealos/scheduler/clients/deepseek.py`（OpenAI SDK 指向 DeepSeek 兼容端点，默认 `deepseek-v4-pro`，与 plan.md "Constraints"段保持一致）
- [X] T053a [P] 创建 `lib/deepseek/client.ts`（Vercel 侧 OpenAI 兼容 SDK 客户端，指向 DeepSeek 端点；默认模型 `deepseek-v4-pro`，与 T053 / plan.md "Constraints" 段保持一致；同时提供同步与流式 SSE 调用包装；从 `process.env.DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` 读取配置）
- [X] T053b [P] 创建 `lib/deepseek/prompts.ts`（Vercel 侧供个股 AI 介绍 / 个股 AI 分析复用的 prompt 模板：`stock-intro` / `stock-analysis`；与 `sealos` 侧模板字符串保持口径一致，便于 US7 弹窗直读，FR-051）
- [X] T054 [P] 创建 `sealos/scheduler/realtime/publish.py`（用 supabase-py 调 `realtime.send` 广播事件）
- [X] T055 [P] 创建 `sealos/scheduler/audit.py` 写入 `audit_logs` 工具
- [X] T056 [P] 创建 `sealos/scheduler/config.py` 从环境变量读取所有 URL/Key

**Checkpoint**: Drizzle schema 已落库；Supabase RLS 已生效；Vercel 与 Sealos 两侧的 client / store / UI 原语 / Realtime / Calendar 工具均就绪，可以开始任意 User Story。

---

## Phase 3: User Story 1 — 邀请码注册与登录闭环（P1）🎯 MVP

**Goal**: 访客通过 `violet-everGarden` 邀请码 + 账号名 + 密码完成注册或登录；7 天免登录可选；未登录访问保护路由被拦截回首页弹窗。

**Independent Test**（spec.md US1 第 (1)–(5) 项）：错误邀请码拒绝；正确邀请码 + 新账号注册成功并跳转 Dashboard；勾选 7 天免登录后关闭浏览器 7 日内仍登录；未登录访问 `/dashboard` 被重定向并打开弹窗。

### Tests for User Story 1

- [ ] T057 [P] [US1] 测试：`POST /api/auth/register` 端点契约（错误邀请码、邮箱格式非法、账号名正则不合法、重复邮箱、重复账号名、注册并发互斥），并断言成功响应包含 FR-009"请前往邮箱完成确认"提示，用例 `tests/integration/api/auth-register.test.ts`
- [ ] T058 [P] [US1] 测试：`POST /api/auth/login` 端点契约（邮箱 + 密码登录、统一错误文案 FR-007、邮箱未确认时返回 FR-009 文案、7 天免登录 cookie 签发），`tests/integration/api/auth-login.test.ts`
- [ ] T059 [P] [US1] 测试：`POST /api/auth/logout` 端点契约（短期 session + long-lived token 同步失效 FR-006），`tests/integration/api/auth-logout.test.ts`
- [ ] T060 [P] [US1] 测试：`middleware.ts` 拦截 `/dashboard` /watchlist/news 三条路径并重定向，`tests/unit/middleware.test.ts`
- [ ] T061 [P] [US1] 测试：`stores/slices/authSlice.ts` action 与 selector，`tests/unit/stores/auth-slice.test.ts`
- [ ] T062 [P] [US1] 测试：`auth-modal` 组件渲染 + MagicCard + 错误行内提示，`tests/unit/components/auth-modal.test.tsx`
- [ ] T062a [P] [US1] 测试：`GET /auth/callback` 路由（FR-009 邮箱确认回跳）—— 携带合法 `code` → `exchangeCodeForSession` 成功 → 重定向到 `redirect` 参数指定地址（缺省回 `/dashboard`）；缺失或非法 `code` → 重定向回首页并打开登录弹窗，`tests/integration/api/auth-callback.test.ts`

### Implementation for User Story 1

- [ ] T063 [P] [US1] 创建 `stores/slices/authSlice.ts`（user / sessionState / rememberMe）
- [ ] T064 [P] [US1] 创建 `lib/supabase/auth.ts` 包装真实邮箱注册/登录：`signUp({ email, password, options: { emailRedirectTo: <SITE_URL>/auth/callback } })` 与 `signInWithPassword({ email, password })`；email 在入参前必须 trim + 小写规范化；同时暴露 `getSession` / `signOut` / `exchangeCodeForSession` 工具函数（FR-002、FR-009、spec.md Assumptions「认证库选型」）
- [ ] T065 [P] [US1] 创建 `lib/auth/long-lived-token.ts`（生成 raw token + SHA-256 hash 入 `long_lived_tokens` 表，签发/验证/吊销）
- [ ] T066 [US1] 实现 `app/api/auth/register/route.ts`：FR-002 校验邀请码严格等于 `violet-everGarden` + 校验邮箱格式 + trim 小写规范化、FR-003 由 Supabase Auth 负责密码散列（不在业务层明文留存）、FR-008 账号名正则 `^[A-Za-z0-9_-]{3,20}$` 服务端校验 + 小写规范化、并发互斥处理 spec Edge Case「注册并发」（同邮箱或同账号名极短时间内重复注册的后一次返回唯一性冲突）；调用 `lib/supabase/auth.ts` 的 `signUp` 后将 `account_name` 与 `auth.user.id` 一并写入 `profiles` 表；响应体须返回 FR-009 要求的"请前往邮箱完成确认"提示（依赖 T064）
- [ ] T067 [US1] 实现 `app/api/auth/login/route.ts`：FR-004 7 天免登录 + FR-007 统一错误"邮箱或密码错误" + 审计日志；当 Supabase 返回 `email_not_confirmed` 错误时改为返回 FR-009 文案"请先完成邮箱确认"且不视为登录成功（依赖 T064、T065）
- [ ] T068 [US1] 实现 `app/api/auth/logout/route.ts`（FR-006 双凭证失效、清 cookie）（依赖 T065）
- [ ] T069 [US1] 完成 `middleware.ts` 完整逻辑：拦截 `(app)` 路由组、解析 `redirect` 参数、刷新 Supabase session、读取 `llt_token` 自动续期（FR-005）
- [ ] T070 [P] [US1] 创建 `hooks/useAuth.ts` 暴露 `register/login/logout/session`
- [ ] T071 [US1] 实现 `app/(public)/layout.tsx` 与 `app/(public)/page.tsx` 首页基础版（含"登录/注册"按钮触发弹窗）
- [ ] T072 [US1] 实现 `app/(auth)/_modals/auth-modal.tsx`（MagicCard 半透明弹窗、Tab 切换注册/登录、FR-001）（依赖 T070）
- [ ] T073 [US1] 实现 `app/(app)/layout.tsx` 登录后路由组壳 + 401 时回弹首页（FR-005 配合 T069）
- [ ] T073a [US1] 实现 `app/auth/callback/route.ts`（FR-009 邮箱确认回跳）：`GET` 处理 Supabase 回跳的 `code` 与 `redirect` 查询参数，调用 T064 暴露的 `exchangeCodeForSession(code)` 建立服务端 session（用 `@supabase/ssr` 写 cookie），成功则 302 到 `redirect` 指定路径（缺省 `/dashboard`），失败则 302 回 `/?login=1` 并附带统一错误提示；同时落审计日志（依赖 T064）
- [ ] T073b [US1] 在 sm（≤640 px）与 lg（≥1024 px）两个断点下手动验证首页 + 登录弹窗 + (app) layout 的渲染、滚动与触达性（FR-110），将截图与差异点附加到 quickstart.md 验收章节

**Checkpoint**: US1 独立可运行——访客可注册/登录/登出，邮箱确认链接点击后建立 session 跳转 Dashboard，7 天免登录持久化，受保护路由被正确拦截。

---

## Phase 4: User Story 2 — 股票数据每日定时抓取与 60 天滚动保留（P1）

**Goal**: Sealos Scheduler 在每个交易日 11:30/15:15 抓 A 股全量行情入 `stock_daily`，仅保留最近 60 个交易日；首次部署执行一次性 60 日历史回填；失败不覆盖既有数据。

**Independent Test**（spec.md US2 第 (1)–(3) 项）：抓取后最新 `trade_date = today`；插入 `today − 61 交易日` 行被清理；模拟上游失败时既有数据保留 + 审计日志写入。

### Tests for User Story 2

- [ ] T074 [P] [US2] 测试：`sealos/scheduler/jobs/stock_daily.py` 11:30/15:15 抓取，`sealos/scheduler/tests/test_stock_daily.py`（respx mock AKTools）
- [ ] T075 [P] [US2] 测试：`sealos/scheduler/jobs/initial_backfill.py` 幂等性（`backfill_completed` 标志 / 表非空时跳过 FR-024），`sealos/scheduler/tests/test_initial_backfill.py`
- [ ] T076 [P] [US2] 测试：`sealos/scheduler/jobs/cleanup.py` 60 日滚动 + `news_items` 7 日滚动（FR-022 / FR-031），`sealos/scheduler/tests/test_cleanup.py`
- [ ] T077 [P] [US2] 测试：`sealos/scheduler/jobs/calendar_refresh.py` 5 市场日历刷新覆盖 180+30 天（FR-120 / SC-052），`sealos/scheduler/tests/test_calendar_refresh.py`
- [ ] T078 [P] [US2] 测试：失败 → audit_log + 既有数据不被覆盖（FR-023），`sealos/scheduler/tests/test_failure_isolation.py`

### Implementation for User Story 2

- [ ] T079 [US2] 实现 `sealos/scheduler/jobs/stock_daily.py`（`stock_daily_midday` + `stock_daily_close`，调 AKTools `stock_zh_a_spot_em`，写 `stock_daily` 与 `stocks`）
- [ ] T080 [US2] 实现 `sealos/scheduler/jobs/initial_backfill.py`（AKShare `stock_zh_a_hist` 拉最近 60 交易日，写一次性标志位）
- [ ] T081 [US2] 实现 `sealos/scheduler/jobs/calendar_refresh.py`（AkShare `tool_trade_date_hist_sina` + pandas-market-calendars，5 市场写入 `market_calendar`）；UPSERT 完成后调 `realtime/publish.py` 广播 `calendar-refresh-done`（FR-106 (g)；affectedBoards=['market-status']；contracts/sealos-jobs.md `calendar_refresh` 第 6 步）
- [ ] T082 [US2] 实现 `sealos/scheduler/jobs/cleanup.py`（`stock_daily` 60 交易日、`news_items` 7 天；保留 `ai_artifacts` 不动，FR-052）
- [ ] T083 [US2] 在 `sealos/scheduler/main.py` 注册以上 4 个 job：cron `30 11 * * 1-5` / `15 15 * * 1-5` + 启动时一次 backfill+calendar
- [ ] T084 [US2] 实现 stock_daily_midday 完成后调 `realtime/publish.py` 广播 `stock-daily-midday`（FR-106 (a)；affectedBoards=['indices','launching-soon','main-uptrend','watchlist','market-status']）；stock_daily_close 完成后广播 `stock-daily-close`（FR-106 (b)，与上同 affectedBoards）；contracts/realtime-events.md 详见两个 EventKind
- [ ] T085 [US2] 实现 A 股休市日跳过逻辑（FR-124 `skipped: A-share holiday` 审计）
- [ ] T086 [US2] Vercel 侧添加 `app/api/dashboard/data-status/route.ts` 返回最近一次成功抓取时间戳（用于 FR-023 "数据截止至" 提示）
- [ ] T087 [US2] 完成 `sealos/scheduler/Dockerfile` + `sealos-deploy.yml` 的 ENV 列表（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEEPSEEK_API_KEY / AKTOOLS_BASE_URL / TZ=Asia/Shanghai）

**Checkpoint**: US2 独立可运行——Sealos 按时抓取，DB 每日有新行，60 日窗口稳定，失败被审计。

---

## Phase 5: User Story 3 — Dashboard 启动在即 + 主升浪（P1）

**Goal**: 登录用户在 Dashboard 看到两份并列名单（启动在即 / 主升浪），按 FR-040 / FR-041 严格筛选，最多各 20 条，涨红跌绿。

**Independent Test**（spec.md US3 (1)–(3)）：所有命中股票满足主板/科创 + 非 ST + 总市值 > 100 亿；启动在即/主升浪各自所有阈值条件成立。

### Tests for User Story 3

- [ ] T090 [P] [US3] 测试：`sealos/scheduler/screens/launching_soon.py` 与 `main_uptrend.py` 对 spec.md Assumptions「区间震荡」「连续上涨」量化定义全部 fixture 的回归测试（振幅、回归斜率、量比基线不含当日；5 日窗口收益、回撤容差），`sealos/scheduler/tests/test_screens.py`
- [ ] T091 [P] [US3] 测试：`GET /api/screens/launching-soon` 与 `main-uptrend` 端点契约（503 无数据态、≤20 条、按 `change_percent DESC` 排序，FR-042），`tests/integration/api/screens.test.ts`
- [ ] T092 [P] [US3] 测试：`launching-soon-list` 与 `main-uptrend-list` 组件单击首帧反馈（原则五），`tests/unit/components/screen-list.test.tsx`

### Implementation for User Story 3

> 设计决策：筛选算法**仅在 Sealos Python 侧实现一次**。Vercel 永远只读 `stock_screen_results` 表（T097 写、T098/T099 读），不在线计算；TS 版（曾计划 `lib/screens/`）已废弃以避免双实现漂移。算法权威阈值参见 spec.md `Assumptions`。

- [ ] T095 [P] [US3] 实现 `sealos/scheduler/screens/launching_soon.py`（FR-040 + Assumptions：振幅、回归斜率、量比基线不含当日）
- [ ] T096 [P] [US3] 实现 `sealos/scheduler/screens/main_uptrend.py`（FR-041 + Assumptions：5 日窗口收益、回撤容差）
- [ ] T097 [US3] 在 `sealos/scheduler/jobs/stock_daily.py` 的 close 任务尾部嵌入预计算并写 `stock_screen_results`（每 (date,kind) 删旧插新事务；写入前对结果按 `change_percent DESC` 排序，FR-042）（依赖 T079、T095、T096）
- [ ] T098 [P] [US3] 实现 `app/api/screens/launching-soon/route.ts`（直接读 `stock_screen_results`，按 `change_percent DESC` 排序，limit 20；503 占位态，FR-042）
- [ ] T099 [P] [US3] 实现 `app/api/screens/main-uptrend/route.ts`（同上口径，FR-042）
- [ ] T100 [P] [US3] 实现 `hooks/useStockScreens.ts`（结合 cacheSlice 缓存当日结果）
- [ ] T101 [P] [US3] 实现 `app/(app)/dashboard/_components/launching-soon-list.tsx`（股票名 + ChangePercent，骨架屏，FR-043）
- [ ] T102 [P] [US3] 实现 `app/(app)/dashboard/_components/main-uptrend-list.tsx`
- [ ] T103 [US3] 实现 `app/(app)/dashboard/page.tsx` 第一版（仅含 launching-soon + main-uptrend 两块，单列布局；后续 phase 替换为 Bento Grid）
- [ ] T104 [US3] 实现 `app/(app)/dashboard/loading.tsx` 骨架屏
- [ ] T104a [US3] 在 sm 与 lg 两个断点下手动验证 `launching-soon-list` / `main-uptrend-list` / Dashboard 第一版的渲染、滚动与触达性（FR-110）

**Checkpoint**: US3 独立可运行——已抓取数据后访问 `/dashboard` 看到两份名单，点击有首帧反馈（菜单待 US7 接入）。

---

## Phase 6: User Story 4 — 自选股管理与 Dashboard 自选股板块（P2）

**Goal**: 登录用户搜索/添加/删除/拖拽排序自选股；Dashboard 自选股板块以虚拟滚动展示当日 + 5 日累计涨跌幅；≥200 显示软提示。

**Independent Test**（spec.md US4 (1)–(3) + AS6）：代码与中文搜索都能命中并合并重复；拖拽刷新顺序保持；Dashboard 板块顺序与管理页一致；≥ 200 出现软提示且仍流畅滚动。

### Tests for User Story 4

- [ ] T105 [P] [US4] 测试：`stores/slices/watchlistSlice.ts` action 与乐观 UI 回滚，`tests/unit/stores/watchlist-slice.test.ts`
- [ ] T106 [P] [US4] 测试：`GET / POST /api/watchlist` + `DELETE [code]` + `PATCH /reorder` 契约（RLS 自隔离、合并重复 FR-010）；并显式断言 FR-013 跨设备一致性——以同一用户 token 在两个独立的 supabase client 实例下分别 `GET /api/watchlist`，结果数组在 `code` 与 `sortOrder` 上完全相等，`tests/integration/api/watchlist.test.ts`
- [ ] T107 [P] [US4] 测试：`GET /api/search/stocks` 代码精确/前缀 + 名称包含 + 上限 10（FR-010），`tests/integration/api/search.test.ts`
- [ ] T108 [P] [US4] 测试：`watchlist-sortable` 拖拽乐观 UI + 回滚（FR-011）+ 渲染 100 条数据时 DOM 节点 ≤ 60（FR-062 管理页虚拟滚动，> 30 条触发），`tests/unit/components/watchlist-sortable.test.tsx`
- [ ] T109 [P] [US4] 测试：`watchlist-widget` 虚拟滚动 DOM 节点 ≤ 60（FR-062 / US4 AS6）+ widget 渲染顺序与 `GET /api/watchlist` 返回顺序逐项一致（FR-060 / US4 AS4），`tests/unit/components/watchlist-widget.test.tsx`

### Implementation for User Story 4

- [ ] T110 [P] [US4] 实现 `stores/slices/watchlistSlice.ts`（draft persist、items、reorder action）
- [ ] T111 [P] [US4] 实现 `app/api/watchlist/route.ts`（GET 含 JOIN stocks + 最近 stock_daily + 5 日累计；POST 合并重复）
- [ ] T112 [P] [US4] 实现 `app/api/watchlist/[code]/route.ts`（DELETE）
- [ ] T113 [P] [US4] 实现 `app/api/watchlist/reorder/route.ts`（事务批改 orderIndex）
- [ ] T114 [P] [US4] 实现 `app/api/search/stocks/route.ts`（代码 + 名称匹配 + ≤10）
- [ ] T115 [P] [US4] 实现 `hooks/useWatchlist.ts` 包装 fetch + 缓存
- [ ] T116 [US4] 实现 `app/(app)/watchlist/page.tsx` 搜索 + 列表 + 拖拽 + 删除（依赖 T110、T115）
- [ ] T117 [US4] 实现 `app/(app)/watchlist/_components/stock-search.tsx` + `watchlist-sortable.tsx`（@dnd-kit + react-virtual，列表 > 30 走虚拟滚动 FR-062）
- [ ] T118 [US4] 实现 `app/(app)/watchlist/_components/too-many-warning.tsx`（≥ 200 软提示，FR-014）
- [ ] T119 [US4] 实现 `app/(app)/dashboard/_components/watchlist-widget.tsx`（虚拟滚动 + 当日涨跌幅 + 5 日累计涨跌幅 + 涨红跌绿；渲染顺序严格沿用 `GET /api/watchlist` 返回的 `orderIndex` 序列，FR-060）
- [ ] T120 [US4] 把 watchlist-widget 接入 `dashboard/page.tsx`（与 US3 列表并列）
- [ ] T120a [US4] 在 sm 与 lg 两个断点下手动验证自选股管理页（搜索 / 拖拽 / 删除 / 软提示）与 Dashboard 自选股 widget 的渲染、滚动与触达性（FR-110）

**Checkpoint**: US4 独立可运行——自选 CRUD 全闭环，Dashboard 板块同步，跨路由无空白闪烁。

---

## Phase 7: User Story 5 — Dashboard 三栏 AI 点评（午评 / 晚评 / 未来预测）（P2）

**Goal**: 11:30 抓取后 10 分钟内出 `midday`；15:15 后出 `evening`；21:00 / 06:00 资讯后出 `forecast`。卡片同时展示 `generated_at` 与 `source_data_at`；过期触发新鲜度标识；失败回退上一版本。

**Independent Test**（spec.md US5 (1)–(3)）：抓取后 10 分钟内三栏对应卡片可见且双时间戳正确；过期出现徽章；失败时仍展示上一次成功内容（FR-053）。

### Tests for User Story 5

- [ ] T121 [P] [US5] 测试：`sealos/scheduler/jobs/ai_generate.py` 三类 kind 写 `ai_artifacts`（generated_at/source_data_at/upstreamHash），`sealos/scheduler/tests/test_ai_generate.py`
- [ ] T122 [P] [US5] 测试：FR-053 失败回退（不写新行，前端读到上一条 failed=false）`sealos/scheduler/tests/test_ai_fallback.py`
- [ ] T123 [P] [US5] 测试：`hooks/useAIArtifact.ts` + `ai-commentary-card.tsx` 双时间戳与新鲜度阈值（midday 24h / evening 24h / forecast 24h，spec.md "AI 产物新鲜度阈值"），`tests/unit/components/ai-commentary-card.test.tsx`

### Implementation for User Story 5

- [ ] T124 [US5] 实现 `sealos/scheduler/prompts.py` 模板（midday / evening / forecast / news-summary / stock-intro / stock-analysis 六套）
- [ ] T125 [US5] 实现 `sealos/scheduler/jobs/ai_generate.py`（三个 cron：midday 11:40、evening 15:25、forecast 21:10 / 06:10；写 `ai_artifacts`；失败仅写 `audit_logs` 不写 artifact）（依赖 T053、T124）
- [ ] T126 [US5] ai_generate 完成后调 publish 广播 `ai-midday-done` / `ai-evening-done` / `ai-forecast-done`（contracts/realtime-events.md）
- [ ] T127 [P] [US5] 实现 `app/api/dashboard/ai-commentary/route.ts` 返回当日最新一条 (kind, primaryKey)（midday / evening / forecast）
- [ ] T128 [P] [US5] 实现 `hooks/useAIArtifact.ts`（按 kind+primaryKey 取 + cacheSlice）
- [ ] T129 [P] [US5] 实现 `app/(app)/dashboard/_components/ai-commentary-card.tsx`（FR-054 双时间戳页脚、FR-055 文字+图标双编码过期标识；spec Edge Case「色盲与夜间模式」）
- [ ] T130 [US5] 把三张 AI 卡片接入 `dashboard/page.tsx`

**Checkpoint**: US5 独立可运行——三栏点评按时刷新，过期/失败两路径都展示正确。

---

## Phase 8: User Story 6 — 新闻模块（24h + AI 总结，7 日滚动）（P2）

**Goal**: 新闻页展示过去 24h CLS 资讯 + 顶部 AI 总结；7 天滚动；总结历史保留。

**Independent Test**（spec.md US6 (1)–(4)）：新闻顶部存在 ≤ 300 字 AI 总结；24h 内列表存在；> 7 天原文已被清理；AI 引用过的总结保留。

### Tests for User Story 6

- [ ] T131 [P] [US6] 测试：`sealos/scheduler/jobs/news_fetch.py` 4 触发时刻 + 去重（FR-030），`sealos/scheduler/tests/test_news_fetch.py`
- [ ] T132 [P] [US6] 测试：`sealos/scheduler/jobs/news_summary.py` 总结 ≤ 300 字 + 历史保留（FR-080），`sealos/scheduler/tests/test_news_summary.py`
- [ ] T133 [P] [US6] 测试：`GET /api/news` 24h 默认 + 7 天扩展（FR-081），`tests/integration/api/news.test.ts`

### Implementation for User Story 6

- [ ] T134 [US6] 实现 `sealos/scheduler/jobs/news_fetch.py`（AkShare `stock_telegraph_cls`，按 `(source, externalId)` 去重）；落库成功后调 `realtime/publish.py` 广播 `news-fetch-done`（FR-106 (c)；affectedBoards=['news-list']；与后续 news-summary-done 解耦，使新闻列表能在原文落库瞬间刷新）
- [ ] T135 [US6] 实现 `sealos/scheduler/jobs/news_summary.py`（聚合 24h 全量 → DeepSeek → 写 `ai_artifacts(kind=news-summary)`）
- [ ] T136 [US6] news_summary 后广播 `news-summary-done`
- [ ] T137 [US6] 注册 4 个 cron：随 stock_daily 同发 + 21:00 + 06:00（FR-030）
- [ ] T138 [P] [US6] 实现 `app/api/news/route.ts`（24h 默认 + `?range=7d`）
- [ ] T139 [P] [US6] 实现 `app/(app)/news/page.tsx` + `_components/news-ai-summary.tsx` + `_components/news-list.tsx`；`news-ai-summary` 卡片页脚必须同时展示 `generated_at`（AI 更新时间）与 `source_data_at`（参考数据时间）双时间戳（FR-054），并按新鲜度阈值用文字 + 视觉双编码呈现过期标识（FR-055，避免单一颜色依赖）

**Checkpoint**: US6 独立可运行——`/news` 实时刷新且 7 日滚动正确。

---

## Phase 9: User Story 7 — 个股弹出菜单 + AI 个股介绍 / 股票分析（P2）

**Goal**: Dashboard 任一股票列表单击 → 首帧浮层 → 选择「介绍 / 分析」→ SSE 流式弹窗；当日同股同类型缓存。

**Independent Test**（spec.md US7 (1)–(4)）：单击首帧菜单可见；两类 AI 文本结构化展示；同日重复点击命中缓存；Esc/外击关闭。

### Tests for User Story 7

- [ ] T140 [P] [US7] 测试：`GET /api/ai/stock-intro/[code]` SSE + 当日缓存命中（FR-092），`tests/integration/api/ai-stock-intro.test.ts`
- [ ] T141 [P] [US7] 测试：`stock-action-menu` 单击 100ms 内可见 + 浮层内同时可见"AI 个股介绍"与"AI 股票分析"两个选项（FR-091）+ Esc 关闭 + 浮层外点击关闭（FR-090 / FR-091 / FR-093 / 原则五），`tests/unit/components/stock-action-menu.test.tsx`
- [ ] T142 [P] [US7] 测试：`stock-ai-dialog` SSE chunk 渐进渲染 + 结构化三段（走势/量价/风险），`tests/unit/components/stock-ai-dialog.test.tsx`

### Implementation for User Story 7

- [ ] T143 [P] [US7] 实现 `app/api/ai/stock-intro/[code]/route.ts`（SSE，先查 ai_artifacts 当日缓存命中即返回；否则调 DeepSeek stream + 写新条目）
- [ ] T144 [P] [US7] 实现 `app/api/ai/stock-analysis/[code]/route.ts`（同上结构）
- [ ] T145 [P] [US7] 实现 `hooks/useStockAI.ts`（封装 EventSource）
- [ ] T146 [P] [US7] 实现 `app/(app)/dashboard/_components/stock-action-menu.tsx`（Popover 浮层，FR-090 首帧）
- [ ] T147 [P] [US7] 实现 `app/(app)/dashboard/_components/stock-ai-dialog.tsx`（双时间戳页脚 FR-054、加载态 + 结构化文本）
- [ ] T148 [US7] 把 stock-action-menu 挂到 `launching-soon-list` / `main-uptrend-list` / `watchlist-widget` 三处条目（依赖 T101、T102、T119、T146）

**Checkpoint**: US7 独立可运行——三处列表点击均触发同一菜单与对话框。

---

## Phase 10: User Story 12 — 多市场休市状态与 A 股休市数据回退（P2）

**Goal**: A 股休市日 Dashboard 顶部横幅 + 数据回退到最近 A 股交易日；市场状态卡片始终展示 5 市场状态；横幅关闭按 Asia/Shanghai 自然日边界持久化。

**Independent Test**（spec.md US12 (1)–(5)）：周六打开 Dashboard 横幅出现且引用上周五；五市场状态卡片正确；切回工作日横幅消失。

### Tests for User Story 12

- [ ] T149 [P] [US12] 测试：`lib/market-calendar/{is-trading-day,last-trading-day}.ts` 各市场判定，`tests/unit/market-calendar.test.ts`
- [ ] T150 [P] [US12] 测试：`GET /api/dashboard/market-status` 返回 5 行状态（FR-123 / FR-125），`tests/integration/api/market-status.test.ts`
- [ ] T151 [P] [US12] 测试：`useHolidayBanner` 自然日 localStorage key（FR-121），`tests/unit/hooks/use-holiday-banner.test.ts`
- [ ] T152 [P] [US12] 测试：A 股休市时 `dashboard/page.tsx` 各板块数据指向 last_trading_day（FR-122），`tests/integration/dashboard-holiday-fallback.test.tsx`

### Implementation for User Story 12

- [ ] T153 [P] [US12] 实现 `app/api/dashboard/market-status/route.ts`（读 `market_calendar` 当日 5 市场，FR-123）
- [ ] T154 [P] [US12] 实现 `hooks/useMarketStatus.ts`
- [ ] T155 [P] [US12] 实现 `hooks/useHolidayBanner.ts`（localStorage key `banner-dismissed-{YYYY-MM-DD}`，Asia/Shanghai 自然日边界）
- [ ] T156 [P] [US12] 实现 `app/(app)/dashboard/_components/market-status-card.tsx`（5 行 + 文字 + 视觉双编码 + 顺序 A→US→HK→JP→KR）
- [ ] T157 [P] [US12] 实现 `app/(app)/dashboard/_components/holiday-banner.tsx`（FR-121 文案 + 关闭按钮）
- [ ] T158 [US12] 在 US3 / US4 / US5 各板块 hook 内引入 `last-trading-day` 回退逻辑（FR-122：休市日数据指向最近 A 股交易日，不展示空数据）
- [ ] T159 [US12] sealos `stock_daily.py` 与 `ai_generate.py` 在 A 股休市日跳过抓取/午评晚评（FR-124 / spec.md Edge Case「A 股休市当日 AI」）
- [ ] T159a [US12] 在 sm 与 lg 两个断点下手动验证 `holiday-banner` 与 `market-status-card` 的渲染、文字 + 视觉双编码、关闭按钮触达性（FR-110）

**Checkpoint**: US12 独立可运行——休市日横幅、卡片、各板块回退口径全对齐。

---

## Phase 11: User Story 8 — 预测推荐板块（≤ 5 个概念板块龙头）（P3）

**Goal**: forecast 任务后挑选 ≤ 5 个利好概念板块 + 各取一只龙头；空态展示「今日无显著利好方向」。

**Independent Test**（spec.md US8 (1)–(3)）：21:00 后展示 1–5 板块；点击龙头复用 US7 菜单；无利好时空态。

### Tests for User Story 8

- [ ] T160 [P] [US8] 测试：`sealos/scheduler/jobs/sector_picks.py` 龙头挑选规则（FR-072 超额收益 + 总市值），`sealos/scheduler/tests/test_sector_picks.py`
- [ ] T161 [P] [US8] 测试：`sector-picks-card` 1/3/5/0（空态）四种渲染，`tests/unit/components/sector-picks-card.test.tsx`

### Implementation for User Story 8

- [ ] T162 [US8] 实现 `sealos/scheduler/jobs/sector_picks.py`：**必须读取当批次最新 forecast `ai_artifacts` 中模型已识别的概念板块清单作为输入**（FR-070 "与 forecast 共享同一份 AI 判断"），**禁止**在本 job 内再次独立调用 LLM 进行板块识别；随后用 AkShare `stock_board_concept_cons_em` 拉取每个命中板块的成分股，按 FR-072 规则挑龙头，写 `sector_picks` + ≤5 行；空时仍写 ai_artifacts 标记空批次（依赖 T125 forecast 产出）
- [ ] T163 [US8] sector_picks 后广播 `sector-picks-done`
- [ ] T164 [P] [US8] 实现 `app/api/dashboard/sector-picks/route.ts`
- [ ] T165 [P] [US8] 实现 `app/(app)/dashboard/_components/sector-picks-card.tsx`（含空态、龙头点击复用 US7 菜单）；卡片页脚必须同时展示 `generated_at` 与 `source_data_at` 双时间戳（FR-054），并按新鲜度阈值用文字 + 视觉双编码呈现过期标识（FR-055，避免单一颜色依赖）
- [ ] T166 [US8] 接入 `dashboard/page.tsx`

**Checkpoint**: US8 独立可运行——预测推荐当日 21:00 后正常展示，空态正确。

---

## Phase 12: User Story 9 — 首页：≥ 3 组动态背景可选（P3）

**Goal**: 首页提供 ≥ 3 组动态背景模块，常量切换；移动端无溢出无卡顿。

**Independent Test**（spec.md US9 (1)–(3)）：当前背景流畅播放；常量改为另一组刷新即生效；移动端断点正常。

### Tests for User Story 9

- [ ] T167 [P] [US9] 测试：3 组背景模块独立挂载 + 切换常量生效，`tests/unit/components/dynamic-bg.test.tsx`

### Implementation for User Story 9

- [ ] T168 [P] [US9] 实现 `app/(public)/_components/dynamic-bg-particles.tsx`（科技粒子）
- [ ] T169 [P] [US9] 实现 `app/(public)/_components/dynamic-bg-gradient.tsx`（渐变流光）
- [ ] T170 [P] [US9] 实现 `app/(public)/_components/dynamic-bg-candle.tsx`（K 线抽象）
- [ ] T171 [US9] 实现 `app/(public)/_components/active-bg.ts` 常量开关 + `next/dynamic` 客户端动态加载；采用**注册表式接口**（如 `BACKGROUNDS = { particles, gradient, candle }`），新增第 4+ 组背景只需新建模块文件并加入注册表，**不需要**改动调用侧或业务代码（FR-100 "≥ 3 组" 留可扩展）
- [ ] T172 [US9] 在 `app/(public)/page.tsx` 挂载 active 背景，主文案对比度可读

**Checkpoint**: US9 独立可运行——背景切换由代码常量驱动，移动端无溢出。

---

## Phase 13: User Story 10 — Dashboard Bento Grid + Number Ticker + Marquee（P3）

**Goal**: Dashboard 用 Bento Grid 布局；指数走 Number Ticker；期货横向 Marquee；行业竖向 Marquee；本期完全固定布局（FR-101 不允许 per-user 重排）。

**Independent Test**（spec.md US10 (1)–(4)）：Bento Grid 明显分块；指数滚动过渡；横向/竖向 Marquee 自动循环。

### Tests for User Story 10

- [ ] T173 [P] [US10] 测试：`indices-ticker` 数值变化触发滚动动画，`tests/unit/components/indices-ticker.test.tsx`
- [ ] T174 [P] [US10] 测试：`futures-marquee` / `industry-marquee` 滚动 + hover 暂停（FR-103），`tests/unit/components/marquee.test.tsx`

### Implementation for User Story 10

- [ ] T175 [P] [US10] 实现 `app/api/dashboard/indices/route.ts`（上证/深证/创业板指数 + 涨跌家数）
- [ ] T176 [P] [US10] 实现 `app/api/dashboard/futures/route.ts`（原油 / 黄金等期货价格）
- [ ] T177 [P] [US10] 实现 `app/api/dashboard/industries/route.ts`（领涨行业列表）
- [ ] T178 [P] [US10] 实现 `app/(app)/dashboard/_components/indices-ticker.tsx`（Number Ticker，FR-102）
- [ ] T179 [P] [US10] 实现 `app/(app)/dashboard/_components/futures-marquee.tsx`（横向 Marquee，FR-103）
- [ ] T180 [P] [US10] 实现 `app/(app)/dashboard/_components/industry-marquee.tsx`（竖向 Marquee，FR-104）
- [ ] T181 [US10] 改写 `dashboard/page.tsx` 用 Bento Grid 重排所有板块（FR-101 完全固定 / sm 与 lg 双断点验证），整合 US3+US4+US5+US12+US8 的所有卡片

**Checkpoint**: US10 独立可运行——Dashboard 视觉成型，移动 / 桌面双断点一致。

---

## Phase 14: User Story 11 — 侧边自动显示 / 隐藏导航栏（P3）

**Goal**: 桌面端 hover 展开侧栏；移动端顶部按钮唤起抽屉；跳转保留 Zustand 状态。

**Independent Test**（spec.md US11 (1)–(3)）：桌面 hover 展开/离开收起；移动端抽屉滑入。

### Tests for User Story 11

- [ ] T182 [P] [US11] 测试：`SideNav` hover 展开 + 路由跳转后 watchlist/cache 不被清（FR-105 + 原则七），`tests/unit/components/side-nav.test.tsx`

### Implementation for User Story 11

- [ ] T183 [US11] 实现 `components/shared/side-nav.tsx`（桌面 hover + 移动端抽屉，主入口 Dashboard / 自选股 / 新闻）
- [ ] T184 [US11] 把 SideNav 挂到 `app/(app)/layout.tsx`，`uiSlice` 持久化展开状态
- [ ] T184a [US11] 在 sm 与 lg 两个断点下手动验证侧栏：sm 移动抽屉滑入 / lg hover 展开收起 / 路由跳转后 watchlist 与 cache 不被清（FR-110 + FR-105）

**Checkpoint**: US11 独立可运行——桌面/移动端导航行为正确，跨路由不清缓存。

---

## Phase 15: Polish — Realtime 订阅 / 手动刷新 / 全链路验证

**Purpose**: 把 Realtime 推送、手动刷新节流、断连重连、Lint 强制 FR-108、quickstart 全链路联调收尾。

- [ ] T185 [P] 测试：`hooks/useRealtimeChannel.ts` 各事件 → 板块 invalidate（contracts/realtime-events.md "客户端订阅与局部刷新映射"），`tests/integration/realtime-channel.test.ts`
- [ ] T186 [P] 测试：FR-111 断连指数退避 + 5 分钟降级提示，`tests/unit/hooks/realtime-reconnect.test.ts`
- [ ] T187 [P] 测试：`POST /api/dashboard/refresh` 10 秒节流 + 冷却态（FR-109），`tests/integration/api/refresh-throttle.test.ts`
- [ ] T188 [P] 测试：ESLint 自定义规则禁轮询命中（FR-108 静态扫描），`tests/lint/no-polling-rule.test.ts`
- [ ] T189 完成 `stores/slices/realtimeSlice.ts` reducer（订阅状态 / 已收事件 / 重连计数）
- [ ] T190 实现 `hooks/useRealtimeChannel.ts`（订阅 `data-updated` + payload 类型守卫 + 局部 invalidate）
- [ ] T191 实现 `app/api/dashboard/refresh/route.ts`（基于内存或 KV 节流 10s/用户）
- [ ] T192 实现 `app/(app)/dashboard/_components/manual-refresh-button.tsx`（pending + 冷却态 + 倒计时）
- [ ] T193 把 `useRealtimeChannel` 挂到 `app/(app)/layout.tsx`，监听全部事件并按 contracts 映射板块刷新（依赖 T044、T100、T115、T128、T154）
- [ ] T194 [P] 在根 `app/layout.tsx` 接入 `next-nprogress-bar`（路由切换顶部进度条，原则五）
- [ ] T195 [P] 跑 `pnpm lint` + `pnpm test` 全绿
- [ ] T196 按 quickstart.md [7] 全链路验证：注册 → 登录 → Dashboard → 自选 → 新闻 → AI 弹窗；记录以下 SC 的实测值并写入 quickstart.md 验收章节：SC-003 / SC-004 / SC-006（前端打点 + Performance API：FCP / LCP / 路由切换 ms）；SC-002（注册接口请求 → "确认邮件已发送"反馈渲染的端到端 ms；以及邮箱确认链接点击 → Dashboard 首屏可见的端到端 ms，前端打点）；SC-010（Sealos `audit_logs` 中 `stock_daily_*` job 触发到完成的耗时 P95，按交易日抽样统计）；SC-013（30 日滚动窗口内 `audit_logs` 中 midday / evening / forecast 三类 AI 任务的成功率统计 SQL，期望 ≥ 95%）
- [ ] T197 [P] 性能与无障碍抽查：sm 与 lg 双断点（SC-040）+ 色盲模拟检查 AI 过期标识（FR-055 + spec Edge Case "色盲与夜间模式"）
- [ ] T198 [P] 抽查 SC-020 / SC-021 / SC-022（筛选硬约束 + 自选涨跌口径偏差 ≤ 0.01%）
- [ ] T199 [P] 抽查 SC-050 / SC-051（A 股休市横幅 100% 命中、五市场判定与权威公告一致）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → 无前置，可立即开工
- **Phase 2 Foundational** → 依赖 Phase 1；Drizzle migration（T034）阻塞 Phase 3+ 所有 DB 任务
- **Phase 3 (US1, P1)** → 依赖 Phase 2 完成
- **Phase 4 (US2, P1)** → 依赖 Phase 2 完成；与 US1 文件无冲突，可并行（T079+ 写 `sealos/`，T066+ 写 `app/api/auth/`）
- **Phase 5 (US3, P1)** → 依赖 Phase 4 至少 T079（要有 stock_daily 数据）+ Phase 2
- **Phase 6 (US4, P2)** → 依赖 Phase 3（要登录），Phase 4 提供股票名/代码搜索数据
- **Phase 7 (US5, P2)** → 依赖 Phase 4（行情）+ Phase 8（资讯，因 forecast 引用 24h 资讯）；至少 T134 必须先于 T125 中 forecast 部分
- **Phase 8 (US6, P2)** → 依赖 Phase 2 + Sealos 骨架（Phase 1 T013–T015）
- **Phase 9 (US7, P2)** → 依赖 Phase 5（要有列表条目可点击）
- **Phase 10 (US12, P2)** → 依赖 Phase 4（行情 + 日历刷新 T081）
- **Phase 11 (US8, P3)** → 依赖 Phase 7（要 forecast 出来）
- **Phase 12 (US9, P3)** → 依赖 Phase 3（首页骨架）
- **Phase 13 (US10, P3)** → 依赖 Phase 5+6+7+10+11（要重排所有板块）
- **Phase 14 (US11, P3)** → 依赖 Phase 3
- **Phase 15 Polish** → 依赖所有 P1+P2 阶段完成；可在 P3 进行中并行

### User Story Dependencies（产品维度）

- **US1 (P1)** 完全独立
- **US2 (P1)** 完全独立（仅依赖 Phase 2 schema）
- **US3 (P1)** 依赖 US2 数据（必须先有 `stock_daily`）
- **US4 (P2)** 依赖 US1（登录态）+ US2（股票元数据）
- **US5 (P2)** 依赖 US2 + US6（forecast 引用资讯）
- **US6 (P2)** 依赖 Phase 2 schema
- **US7 (P2)** 依赖任一含股票列表的页面（US3 / US4）
- **US8 (P3)** 依赖 US5 forecast
- **US9 (P3)** 依赖 US1 首页骨架
- **US10 (P3)** 依赖 US3+US4+US5（Bento Grid 重排所有板块）
- **US11 (P3)** 依赖 US1（路由组）
- **US12 (P2)** 依赖 US2（日历）+ 各板块 hook（US3/4/5 数据回退）

### Within Each User Story

- 测试先写并 FAIL（原则二）
- Models / 算法 → Services / API → UI 组件 → 接入页面
- 同 phase 内 [P] 标记的不同文件可并行；带依赖说明的串行

### Parallel Opportunities

- **Phase 1**：T002 / T003 / T004 / T005 / T006 / T007 / T008 / T010 / T011 / T013 / T014 / T015 / T016 全部可并行（不同文件）
- **Phase 2**：T017–T028 共 12 个 schema 文件互不依赖可全并；T035–T038 / T040–T049 / T050–T056 三组各自互不依赖
- **每个 US 内的 Tests**：全部 [P] 同时写
- **跨 US**：P1 三个故事（US1 / US2 / US3）可三人并行（US3 等 US2 抓取完再跑端到端）；P2 五个故事 US4 / US5 / US6 / US7 / US12 可五人并行；P3 四个故事可四人并行

---

## Parallel Example: Phase 2 Schema 落地

```bash
# 同一时刻发起 12 个 schema 文件创建任务（全 [P]）
Task: "创建 lib/db/schema/profiles.ts"          # T017
Task: "创建 lib/db/schema/long-lived-tokens.ts"  # T018
Task: "创建 lib/db/schema/invite-codes.ts"       # T019
Task: "创建 lib/db/schema/stocks.ts"             # T020
Task: "创建 lib/db/schema/stock-daily.ts"        # T021
Task: "创建 lib/db/schema/stock-screen-results.ts" # T022
Task: "创建 lib/db/schema/watchlist-items.ts"    # T023
Task: "创建 lib/db/schema/news-items.ts"         # T024
Task: "创建 lib/db/schema/ai-artifacts.ts"       # T025
Task: "创建 lib/db/schema/sector-picks.ts"       # T026
Task: "创建 lib/db/schema/market-calendar.ts"    # T027
Task: "创建 lib/db/schema/audit-logs.ts"         # T028
# 12 个完成后 → T029 汇总 index.ts → T030 client → T031 generate → T032/T033 RLS+seed → T034 migrate
```

## Parallel Example: User Story 1 Tests

```bash
# US1 阶段一开始就可同时启动所有测试（先 FAIL，再实现）：
Task: "T057 register API 契约测试"
Task: "T058 login API 契约测试"
Task: "T059 logout API 契约测试"
Task: "T060 middleware 拦截单测"
Task: "T061 authSlice 单测"
Task: "T062 auth-modal 组件单测"
```

---

## Implementation Strategy

### MVP First（仅 US1 + US2 + US3，三个 P1）

1. Phase 1 Setup
2. Phase 2 Foundational（schema + RLS + 共享工具）
3. Phase 3 US1 — 邀请码注册登录
4. Phase 4 US2 — 抓取 + 60 日（Sealos 部署进生产）
5. Phase 5 US3 — Dashboard 启动在即 + 主升浪
6. **STOP & VALIDATE**：登录 → Dashboard 看见今日两份名单 → 这就是 MVP，可演示
7. Phase 15 的 Realtime/手动刷新基础部分先做 T189–T193，把"15:15 后 Dashboard 自动 Realtime 刷新"打通，闭合 P1 体验

### Incremental Delivery（每个 phase 一次发布）

1. **MVP 发布**：US1 + US2 + US3
2. **第二里程碑**：+ US4（自选股）+ US12（休市状态）→ 产品基本可日常使用
3. **第三里程碑**：+ US5 + US6 + US7 → AI 体验全员上线
4. **第四里程碑**：+ US8 + US9 + US10 + US11 → 视觉与扩展功能完整
5. **收尾**：Phase 15 Polish（Realtime 全套 + Lint 强制 + quickstart 全链路）

### Parallel Team Strategy

5 人团队样例（基于 plan.md 的双层架构特性）：

1. 全员一起完成 Phase 1+2（schema 是共同前置）
2. 解锁后并行：
   - Dev A（前端） → US1 + US9 + US11
   - Dev B（前端） → US3 + US4 + US10
   - Dev C（前端） → US5 + US7 + US12
   - Dev D（Sealos） → US2 + US6 + US8
   - Dev E（共享） → Phase 15 + Realtime 整合 + 性能/无障碍抽查
3. 每个 US 完成后独立可演示，互不阻塞

---

## Notes

- [P] = 不同文件、无未完成依赖
- [Story] 标签让任务直接映射到 spec.md 中的 User Story（US1…US12）+ FR-xxx 编号
- 每条任务给出**可直接执行**的相对路径，避免实现期再来回查 plan
- 测试先写并 FAIL，再写实现（原则二硬约束）
- 每个 checkpoint 可独立交付/演示，不破坏既有故事
- **避免**：跨 User Story 的隐式耦合（US7 必须依赖明确传入的列表 props，不直接依赖 US3 的实现细节）
- 总任务数：**204**（Setup 16 + Foundational 42 + US1 20 + US2 14 + US3 14 + US4 17 + US5 10 + US6 9 + US7 9 + US12 12 + US8 7 + US9 6 + US10 9 + US11 4 + Polish 15）。US3 较初版减少 4 条（删除 TS 版筛选 T088/T089/T093/T094，并把 T090 从 parity 测试改为单侧 fixture 回归测试），原因见 Phase 5 设计决策段。
