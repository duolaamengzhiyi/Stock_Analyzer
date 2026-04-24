# Contract: Vercel Web API (Next.js Route Handlers)

**Feature**: 001-initialization
**Date**: 2026-04-22
**所在位置**: `app/api/**/route.ts`

本文是 Next.js 侧对浏览器暴露的 HTTP 接口契约。所有接口默认要求有效
Supabase session（通过 cookie），公开端点明确标注。

---

## 约定

- **请求/响应格式**：JSON（除 `/api/ai/**` 的流式响应使用 SSE）。
- **错误响应**：

  ```json
  { "error": { "code": "STRING_CODE", "message": "用户可读描述" } }
  ```

  HTTP 状态码语义：
  - `400` 参数错误（body 校验失败）
  - `401` 未登录（中间件也会拦截非登录路由，这里是 API 层二次校验）
  - `403` 已登录但无权访问（如越权读他人自选股）
  - `409` 冲突（如账号名已存在）
  - `429` 被节流（手动刷新 10s 冷却）
  - `5xx` 服务端错误

- **认证**：Route Handler 在顶部读 `createServerClient()`（@supabase/ssr），
  未登录直接 401。中间件 `middleware.ts` 负责路由页面级拦截，重定向逻辑在
  那里；API 请求一律直接返回 401，由客户端决定 UI 反应。

---

## Auth（公开）

### `POST /api/auth/register`

用户注册。校验邀请码 + 账号名 + 密码；占位邮箱包装后写入 Supabase Auth +
业务 `profiles`。

```yaml
request:
  body:
    inviteCode: string (required, 严格等于 'violet-everGarden' 才通过)
    username: string (required, ^[A-Za-z0-9_-]{3,20}$)
    password: string (required, ≥ 8, 至少字母+数字)
    rememberMe: boolean (default false, 决定是否签发 long-lived token)
responses:
  201:
    body: { userId: string, username: string }
    sets-cookie: sb-access-token, sb-refresh-token, (optional) llt_token
  400: INVALID_USERNAME | WEAK_PASSWORD | INVALID_INVITE_CODE
  409: USERNAME_TAKEN
```

**实现要点**:

- 账号名正则以 Zod 校验（FR-008），不依赖前端；trim + 转小写后存储。
- 用 service_role 查 `invite_codes`（FR-002 严格一致比较）。
- 调用 `supabase.auth.signUp({ email: `${username}@stock-analyzer.local`,
  password })`；成功后以 service_role 在 `profiles` 插入映射。
- `rememberMe=true` 时签发 `long_lived_tokens` 一行，raw token 写入 cookie
  并返回 SHA-256 hash 落库。

### `POST /api/auth/login`

```yaml
request:
  body:
    username: string (required)
    password: string (required)
    rememberMe: boolean (default false)
responses:
  200:
    body: { userId: string, username: string }
    sets-cookie: sb-access-token, sb-refresh-token, (optional) llt_token
  401: INVALID_CREDENTIALS (统一文案"账号或密码错误"，FR-007)
```

**实现要点**:

- 即便账号不存在，也返回统一错误（防账号枚举，FR-007）。
- 失败事件写入 `audit_logs(kind='login-failure')`。
- 成功后更新 `profiles.last_login_at`。

### `POST /api/auth/logout`

```yaml
request: (no body, cookie only)
responses:
  204: (no body, clears cookies, revokes llt if exists)
```

**实现要点**:

- 调用 `supabase.auth.signOut()` 失效短期 session。
- 若 cookie 含 `llt_token`，以 service_role 标记 `long_lived_tokens.revoked_at=now()`
  （FR-006 + SC-031）。

---

## Watchlist（需登录）

### `GET /api/watchlist`

返回当前用户的自选股 + 最新行情快照。

```yaml
responses:
  200:
    body:
      items:
        - code: string
          name: string
          orderIndex: integer
          latest:
            tradeDate: string (YYYY-MM-DD, 可能是"最近一个 A 股交易日")
            close: number
            changePct: number
            fiveDayChangePct: number | null
```

**实现要点**:

- 走 RLS（authenticated + self），service_role 不需要。
- 同一次请求里通过 JOIN `stocks` + 最近 `stock_daily` + 5 日滚动累计。
- 若当日 A 股休市，`latest.tradeDate` 取 `market_calendar` 最近开市日
  （FR-122）。

### `POST /api/watchlist`

```yaml
request:
  body:
    code: string (6 位股票代码)
responses:
  201: { id: uuid, code, orderIndex }
  404: STOCK_NOT_FOUND
  409: ALREADY_IN_WATCHLIST
```

### `DELETE /api/watchlist/[code]`

```yaml
responses:
  204: (success)
  404: NOT_IN_WATCHLIST
```

### `PATCH /api/watchlist/reorder`

```yaml
request:
  body:
    codes: string[] (完整按新顺序的自选代码列表，必须与现有集合一致)
responses:
  200: { items: [{code, orderIndex}] }
  400: LIST_MISMATCH (codes 与当前自选集合不一致)
```

**实现要点**:

- 服务端事务更新所有 `orderIndex`；乐观 UI 失败时前端回滚
  （FR-011 / Edge Case 拖拽排序失败回滚）。

---

## Search（需登录）

### `GET /api/search/stocks?q=XX`

```yaml
query:
  q: string (中文名关键词 ≥ 2 字, 或 6 位代码)
responses:
  200:
    body:
      matches:
        - code: string
          name: string
          market: 'MAIN' | 'STAR' | 'GEM' | 'BJ'
```

**实现要点**:

- 代码数字匹配：精确 + 前缀；名称中文匹配：包含（`ILIKE '%q%'`）。
- 最多返回前 10 条（FR-010b AS2）。
- 直接查 Drizzle `stocks` 表，不调外部 AKTools（避免每次搜索都打 Sealos）。
- 若结果为空 0 条且 `stocks` 表为空（未完成初始化），返回 503 +
  `SYSTEM_NOT_READY` 提示。

---

## Screens（需登录）

### `GET /api/screens/launching-soon`

### `GET /api/screens/main-uptrend`

两个端点对称，只是 `kind` 不同。

```yaml
responses:
  200:
    body:
      tradeDate: string (YYYY-MM-DD, 最近一次筛选所用日期)
      generatedAt: string (ISO, 筛选完成时间)
      items:
        - code: string
          name: string
          rank: integer
          changePct: number
```

**实现要点**:

- 直接读 `stock_screen_results`；不即时计算。
- 若表内当日无数据（如系统刚上线回填还没完成），返回 `{ items: [] }` +
  `tradeDate: null`，前端显示"样本不足"占位（Edge Cases / AS5）。

---

## Dashboard aggregates（需登录）

### `GET /api/dashboard/indices`

返回 Number Ticker 所需指数 + 涨跌家数。

```yaml
responses:
  200:
    body:
      tradeDate: string
      indices:
        - code: string  (e.g., 'SH000001' 上证指数)
          name: string
          value: number
          changePct: number
      advances: integer
      declines: integer
      unchanged: integer
```

### `GET /api/dashboard/market-status`

返回 5 市场状态（US12 / FR-123）。

```yaml
responses:
  200:
    body:
      date: string (Asia/Shanghai 今天自然日)
      markets:
        - market: 'CN_A' | 'US' | 'HK' | 'JP' | 'KR'
          isOpen: boolean
          memo: string | null  (如 '元旦休市')
      lastCnTradingDay: string (YYYY-MM-DD)
```

### `POST /api/dashboard/refresh`

手动刷新按钮（FR-109）。仅清缓存 + 返回最新时间戳，不实际触发上游抓取。

```yaml
responses:
  200:
    body:
      invalidated: ['screens', 'watchlist', 'indices', 'ai', 'market-status']
      serverTime: string (ISO)
  429: RATE_LIMITED (10s 冷却内再次调用)
```

**实现要点**:

- 服务端内存（或 Redis）记录 `${userId}:last-manual-refresh`；10s 内拒绝。
- 不实际写任何表；仅返回"请重新拉取"信号，由前端 Hook 重新调各 GET 端点。

---

## AI（需登录，按需）

### `GET /api/ai/stock-intro/[code]` (SSE)

### `GET /api/ai/stock-analysis/[code]` (SSE)

两个端点对称，返回 `text/event-stream`。

**响应**（成功）：

```text
event: open
data: { "generatedAt": "2026-04-22T10:05:00+08:00", "sourceDataAt": "2026-04-22T08:00:00+08:00", "cached": true }

event: chunk
data: { "text": "贵州茅台" }

event: chunk
data: { "text": "是一家" }

...

event: done
data: { "totalTokens": 420 }
```

**响应**（失败）：

```text
event: error
data: { "code": "LLM_FAILURE", "message": "暂时无法生成介绍，请稍后重试" }
```

**实现要点**:

- 先查 `ai_artifacts`（kind=`stock-intro`/`stock-analysis`, primary_key=code,
  failed=false 最新），若在新鲜度阈值内直接流出缓存内容（FR-092 命中缓存）。
- 否则调 Kimi stream，逐 chunk 转发；成功后 INSERT 新条目。
- 若 Kimi 失败但 DB 有过期旧条目：
  - `stock-intro`（30 天阈值）：直接用旧条目 + `source_data_at` 过期标识；
  - `stock-analysis`（1 交易日阈值）：同上；前端展示"已过期"徽章
    （FR-054 / FR-055）。
- 单用户同时 ≤ 1 个 in-flight AI 请求（简易内存锁），防刷。

---

## News（需登录）

### `GET /api/news`

```yaml
query:
  since: string? (ISO, 默认 now - 24h)
  kind: 'summary' | 'list' | 'both' (default 'both')
responses:
  200:
    body:
      aiSummary:
        content: string
        generatedAt: string
        sourceDataAt: string
      items:
        - id: uuid
          title: string
          source: string
          summary: string
          body: string
          publishedAt: string
          url: string | null
```

---

## Internal（Sealos → Vercel 回调，可选）

本期默认 **不使用**（Sealos 直接写 Supabase + 广播 Realtime 即可）。保留
placeholder 以便未来需要时启用：

### `POST /api/internal/notify` (可选)

```yaml
auth: header 'X-Scheduler-Token' must match SEALOS_CALLBACK_TOKEN
request:
  body:
    event: 'stock-daily-done' | 'ai-midday-done' | ...
    payload: ...
responses:
  204:
  401: BAD_TOKEN
```

若启用，由 Sealos Scheduler 在任务完成后 POST 到此端点；Vercel 用来记录
审计日志或触发额外的服务端缓存失效。

---

## HTTP 状态码 + 错误码一览

| Code | 含义 | 出现在 |
|------|------|------|
| `INVALID_USERNAME` | 账号名不符合正则 | `/auth/register` |
| `WEAK_PASSWORD` | 密码不足 8 位或无字母数字混合 | `/auth/register` |
| `INVALID_INVITE_CODE` | 邀请码错误 | `/auth/register` |
| `USERNAME_TAKEN` | 账号名已存在 | `/auth/register` |
| `INVALID_CREDENTIALS` | 登录失败统一文案 | `/auth/login` |
| `STOCK_NOT_FOUND` | 添加自选时代码不存在 | `/watchlist` |
| `ALREADY_IN_WATCHLIST` | 重复添加 | `/watchlist` |
| `NOT_IN_WATCHLIST` | 删除不存在的自选 | `/watchlist/[code]` |
| `LIST_MISMATCH` | 重排的 codes 与当前自选集合不一致 | `/watchlist/reorder` |
| `SYSTEM_NOT_READY` | 初始化未完成（`stocks` 为空） | `/search/stocks` |
| `RATE_LIMITED` | 手动刷新 10s 内再次触发 | `/dashboard/refresh` |
| `LLM_FAILURE` | Kimi 调用失败 | SSE AI 端点 |
| `BAD_TOKEN` | Sealos 回调鉴权失败 | `/internal/notify` |
