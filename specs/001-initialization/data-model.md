# Phase 1: Data Model — Stock Analyzer Platform Initialization

**Feature**: 001-initialization
**Date**: 2026-04-22
**所在位置**: `lib/db/schema/*.ts`（Drizzle definition） + Supabase auth schema（自带）

本文是所有数据库 schema 的**权威说明**。Drizzle migration 由 `drizzle-kit
generate` 从 `lib/db/schema/*.ts` 派生；Sealos Python Scheduler **只读写
已存在的表**，严禁 DDL（见 research.md R7）。

---

## 表总览（11 张业务表 + Supabase 自带 auth schema）

| 表名 | 用途 | 保留策略 | 写入方 |
|------|------|--------|------|
| `auth.users` | Supabase 自带 | 用户生命周期 | Supabase Auth |
| `profiles` | 账号名 ↔ auth.users 映射 + 个人资料 | 永久 | Vercel（注册时） |
| `long_lived_tokens` | 7 天免登录凭证 | 到期或登出失效 | Vercel |
| `invite_codes` | 邀请码配置（当前单条） | 永久 | 手动种子 |
| `stocks` | 股票元数据 | 永久（可软删） | Scheduler |
| `stock_daily` | 日行情 | **仅 60 个 A 股交易日** | Scheduler |
| `stock_screen_results` | 筛选结果快照 | 跟随 stock_daily 60 日 | Scheduler |
| `watchlist_items` | 用户自选关系 | 用户生命周期 | Vercel（用户操作） |
| `news_items` | CLS 电报原文 | **近 7 天** | Scheduler |
| `ai_artifacts` | AI 生成内容 | **永久** | Scheduler + Vercel（按需 AI） |
| `sector_picks` | 预测推荐条目 | 永久 | Scheduler |
| `market_calendar` | 5 市场交易日历 | 过去 180 天 + 未来 365 天 | Scheduler |
| `audit_logs` | 任务审计 | 永久 | Scheduler + Vercel |

---

## 1. `profiles`

Supabase Auth 的 `auth.users` 只有 `id (uuid)`, `email`, `encrypted_password`
等系统字段；`profiles` 承载业务层的账号名与个人资料，与 `auth.users` 按
1:1 关联。

```ts
// lib/db/schema/profiles.ts
export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  username: varchar('username', { length: 20 }).notNull().unique(), // 已小写规范化
  usernameDisplay: varchar('username_display', { length: 20 }).notNull(), // 保留用户原写
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (t) => ({
  usernameIdx: uniqueIndex('profiles_username_idx').on(t.username),
}));
```

**约束与索引**:

- `username` 满足正则 `^[a-z0-9_-]{3,20}$`（已小写，FR-008）；由 Route
  Handler 层以 Zod 校验，不在 DB 加 CHECK（跨端一致性靠 schema + runtime
  validator 双重保障）。
- `username` 唯一索引支持 O(1) 反查 `username → user_id`，登录时用到。
- `usernameDisplay` 保留用户**原始输入**（大小写），仅作展示；如
  `"Violet_G"` → DB 存 `violet_g`，展示 `Violet_G`。

**RLS**:

```sql
-- 自己可读自己
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 注册流程在服务端以 service_role 插入；anon / authenticated 禁止 INSERT
-- 登录后可更新自己的 last_login_at（由服务端触发）
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## 2. `long_lived_tokens`

承载 7 天免登录的长期凭证（FR-004）。与 Supabase session 不同，这里是**业务
层自行签发**的 opaque token，写入 `HttpOnly + Secure + SameSite=Lax` cookie。

```ts
// lib/db/schema/long-lived-tokens.ts
export const longLivedTokens = pgTable('long_lived_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull()
    .references(() => profiles.userId, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(), // SHA-256 of raw token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 64 }),
}, (t) => ({
  userIdx: index('llt_user_idx').on(t.userId),
  hashIdx: uniqueIndex('llt_hash_idx').on(t.tokenHash),
  expIdx: index('llt_exp_idx').on(t.expiresAt),
}));
```

**约束**:

- `token_hash` 为 SHA-256(raw token)，raw token 只存在于客户端 cookie；DB
  即便泄露也无法复原 raw token。
- 登出时 `revoked_at = now()`（FR-006）；定期清理 `revoked_at < now() - 30d`
  的历史记录（`cleanup` job 带做）。

**RLS**: **全关**，仅 service_role 可访问。

---

## 3. `invite_codes`

本期单条：`('violet-everGarden', reusable=true)`，通过 Drizzle seed 脚本
或手动 `INSERT` 注入。

```ts
// lib/db/schema/invite-codes.ts
export const inviteCodes = pgTable('invite_codes', {
  code: varchar('code', { length: 64 }).primaryKey(),
  reusable: boolean('reusable').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  description: text('description'),
});
```

**RLS**: **全关**（anon + authenticated 都不能读）。Route Handler 注册
流程以 service_role 查这一张表。

---

## 4. `stocks`（股票元数据）

```ts
export const stocks = pgTable('stocks', {
  code: varchar('code', { length: 6 }).primaryKey(), // '600519'
  name: varchar('name', { length: 32 }).notNull(),   // '贵州茅台'
  market: varchar('market', { length: 8 }).notNull(), // 'MAIN' | 'STAR' | 'GEM' | 'BJ'
  isSt: boolean('is_st').notNull().default(false),
  delisted: boolean('delisted').notNull().default(false),
  industryL1: varchar('industry_l1', { length: 32 }), // 申万一级，仅存不用于筛选
  concepts: text('concepts').array(), // 文本数组：命中的概念板块名（用于个股介绍）
  latestMarketCap: numeric('latest_market_cap', { precision: 20, scale: 2 }), // 总市值，元
  latestSnapshotAt: timestamp('latest_snapshot_at', { withTimezone: true }),
}, (t) => ({
  marketIdx: index('stocks_market_idx').on(t.market),
  nameIdx: index('stocks_name_idx').on(t.name), // 中文名搜索
}));
```

**约束**:

- `market` 取值明确限定 `MAIN`（主板）/ `STAR`（科创）/ `GEM`（创业）/ `BJ`
  （北交所）。筛选仅允许 `MAIN` + `STAR`（FR-040c / FR-041c）。
- `concepts` 保存命中的概念板块名列表（如 `['人工智能算力', '数据要素']`），
  用于个股 AI 介绍（stock-intro）时作为上下文。

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 5. `stock_daily`（日行情 · 60 日滚动）

表规模最大：5500 × 60 ≈ 33 万行。主键 `(code, trade_date)`。

```ts
export const stockDaily = pgTable('stock_daily', {
  code: varchar('code', { length: 6 }).notNull()
    .references(() => stocks.code, { onDelete: 'cascade' }),
  tradeDate: date('trade_date').notNull(), // A 股交易日
  open: numeric('open', { precision: 12, scale: 4 }),
  high: numeric('high', { precision: 12, scale: 4 }),
  low: numeric('low', { precision: 12, scale: 4 }),
  close: numeric('close', { precision: 12, scale: 4 }).notNull(),
  volume: numeric('volume', { precision: 20, scale: 0 }).notNull(),
  turnover: numeric('turnover', { precision: 20, scale: 2 }),
  changePct: numeric('change_pct', { precision: 8, scale: 4 }), // 当日涨跌幅 %
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.code, t.tradeDate] }),
  dateIdx: index('stock_daily_date_idx').on(t.tradeDate),
  dateCodeIdx: index('stock_daily_date_code_idx').on(t.tradeDate, t.code),
}));
```

**保留策略**: Scheduler 的 `cleanup` job 在每次抓取成功后执行：

```sql
DELETE FROM stock_daily
WHERE trade_date < (
  SELECT date
  FROM market_calendar
  WHERE market = 'CN_A' AND is_open = true
  ORDER BY date DESC
  LIMIT 1 OFFSET 59
);
```

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 6. `stock_screen_results`（筛选结果快照）

Scheduler 每日 15:15 抓取完成后预计算两份筛选结果并落表，前端直接读，避免
每次请求重算 33 万行。

```ts
export const stockScreenResults = pgTable('stock_screen_results', {
  tradeDate: date('trade_date').notNull(),
  kind: varchar('kind', { length: 24 }).notNull(), // 'launching-soon' | 'main-uptrend'
  code: varchar('code', { length: 6 }).notNull()
    .references(() => stocks.code),
  rank: integer('rank').notNull(), // 排序序号（FR-042 按当日涨跌幅降序）
  snapshotChangePct: numeric('snapshot_change_pct', { precision: 8, scale: 4 }), // 当日涨跌幅（展示用）
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  debugMeta: jsonb('debug_meta'), // 算法中间量，便于排查（振幅、回归斜率等）
}, (t) => ({
  pk: primaryKey({ columns: [t.tradeDate, t.kind, t.code] }),
  dateKindIdx: index('ssr_date_kind_idx').on(t.tradeDate, t.kind, t.rank),
}));
```

**约束**:

- 每对 `(tradeDate, kind)` 最多 20 条（FR-042 默认上限）。
- 写入时在单事务里 `DELETE + INSERT` 当日该 kind 全部记录，保证原子性。

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 7. `watchlist_items`（自选股条目）

```ts
export const watchlistItems = pgTable('watchlist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull()
    .references(() => profiles.userId, { onDelete: 'cascade' }),
  code: varchar('code', { length: 6 }).notNull()
    .references(() => stocks.code, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(), // 排序，从 0 开始
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userCodeUnique: uniqueIndex('wi_user_code_idx').on(t.userId, t.code),
  userOrderIdx: index('wi_user_order_idx').on(t.userId, t.orderIndex),
}));
```

**约束**:

- `(userId, code)` 唯一，保证同股票只能自选一次（FR-010 重复合并）。
- 重排批量操作在服务端事务里更新整个用户的所有 `orderIndex`。

**RLS**:

```sql
CREATE POLICY "wi_self_all" ON watchlist_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 8. `news_items`（资讯条目 · 7 日滚动）

```ts
export const newsItems = pgTable('news_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: varchar('source', { length: 16 }).notNull(), // 'CLS' | 'CCTV' | ...
  externalId: varchar('external_id', { length: 64 }), // CLS 原始 id
  title: text('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull(),
  url: text('url'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sourceExtIdx: uniqueIndex('ni_source_ext_idx').on(t.source, t.externalId),
  publishedIdx: index('ni_published_idx').on(t.publishedAt.desc()),
}));
```

**保留策略**: `cleanup` job：`DELETE FROM news_items WHERE published_at < now() -
INTERVAL '7 days'`（FR-031）。被 AI 引用过的总结 / 点评文本保存在 `ai_artifacts`，
不受此清理影响。

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 9. `ai_artifacts`（AI 生成产物 · 永久保留）

**最关键的表之一**，承载 FR-052（双时间戳）+ FR-053（失败回退）+ FR-054
（UI 双时间戳展示）+ FR-055（新鲜度阈值）全部逻辑。

```ts
export const aiArtifacts = pgTable('ai_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 24 }).notNull(),
  //   'midday' | 'evening' | 'forecast' | 'news-summary' |
  //   'stock-intro' | 'stock-analysis' | 'sector-picks-batch'
  primaryKey: varchar('primary_key', { length: 32 }).notNull(),
  //   午评/晚评/未来预测：交易日 'YYYY-MM-DD'
  //   news-summary：批次 ISO 时间 '2026-04-22T21:10:00+08'
  //   stock-intro / stock-analysis：股票代码 '600519'
  //   sector-picks-batch：交易日 'YYYY-MM-DD'
  content: text('content').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  sourceDataAt: timestamp('source_data_at', { withTimezone: true }).notNull(),
  upstreamHash: varchar('upstream_hash', { length: 64 }), // 所用上下文的 SHA-256（便于排查）
  model: varchar('model', { length: 40 }),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  failed: boolean('failed').notNull().default(false), // 失败版本标记（FR-053 回退参照）
}, (t) => ({
  kindKeyIdx: index('ai_kind_key_idx').on(t.kind, t.primaryKey, t.generatedAt.desc()),
  kindDateIdx: index('ai_kind_sourcedate_idx').on(t.kind, t.sourceDataAt.desc()),
}));
```

**写入规则**:

- 每次成功生成 INSERT 一条新记录，**不** UPDATE 旧记录（保留历史）。
- Vercel / Scheduler 读取时取 `(kind, primaryKey)` 下 `failed=false` 且
  `generatedAt` 最新的一条（FR-053 "回退到上一版本"由此实现）。
- 失败不写入 DB；前端继续读到上一条即可。

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 10. `sector_picks`（预测推荐条目）

与 `ai_artifacts` 的 `kind='sector-picks-batch'` 一对多关联。`ai_artifacts`
只存"当日预测推荐的综述文字（可选）"，此表存结构化条目。

```ts
export const sectorPicks = pgTable('sector_picks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tradeDate: date('trade_date').notNull(),
  rank: integer('rank').notNull(), // 1..5
  conceptBoardCode: varchar('concept_board_code', { length: 16 }).notNull(),
  //   东方财富概念板块代号，如 'BK0855'
  conceptBoardName: varchar('concept_board_name', { length: 32 }).notNull(), // '虚拟现实'
  leaderCode: varchar('leader_code', { length: 6 })
    .references(() => stocks.code),
  leaderName: varchar('leader_name', { length: 32 }),
  rationaleShort: text('rationale_short'), // 为什么入选（DeepSeek 一句话）
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: uniqueIndex('sp_date_rank_idx').on(t.tradeDate, t.rank),
  dateIdx: index('sp_date_idx').on(t.tradeDate.desc()),
}));
```

**RLS**: 登录用户可 SELECT，写入仅 service_role。

---

## 11. `market_calendar`（5 市场交易日历）

```ts
export const marketCalendar = pgTable('market_calendar', {
  market: varchar('market', { length: 8 }).notNull(),
  //   'CN_A' | 'US' | 'HK' | 'JP' | 'KR'
  date: date('date').notNull(), // Asia/Shanghai 所属自然日
  isOpen: boolean('is_open').notNull(),
  memo: text('memo'), // 节假日名称，如 '元旦' / 'Christmas'
}, (t) => ({
  pk: primaryKey({ columns: [t.market, t.date] }),
  dateIdx: index('mc_date_idx').on(t.date),
}));
```

**窗口约束**: `cleanup` + `calendar_refresh` job 共同保障始终覆盖"过去
180 天 + 未来 365 天"（FR-120 + SC-052）。

**RLS**: 登录用户可 SELECT（Dashboard 市场状态卡片 + Vercel Route
Handler），写入仅 service_role。

---

## 12. `audit_logs`（任务审计）

```ts
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 32 }).notNull(),
  //   'stock-fetch' | 'news-fetch' | 'ai-generate' | 'cleanup' |
  //   'initial-backfill' | 'login-failure' | 'login-success' |
  //   'register' | 'manual-refresh'
  status: varchar('status', { length: 16 }).notNull(), // 'success' | 'skipped' | 'failed'
  subject: varchar('subject', { length: 64 }), // 事件目标（kind / username / code 等）
  meta: jsonb('meta'), // 自由扩展字段
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  errorDetail: text('error_detail'),
}, (t) => ({
  kindIdx: index('al_kind_idx').on(t.kind, t.occurredAt.desc()),
}));
```

**RLS**: 全关（service_role only）。将来管理后台 feature 会开放给管理员
角色读取。

---

## 关系图（简化 ER）

```text
  auth.users ──┐
               │ 1:1
  profiles ────┤─────── long_lived_tokens (N)
               │
               ├─────── watchlist_items (N) ────> stocks
               └─────── audit_logs (N)

  stocks ─────┬─── stock_daily (N)
              ├─── stock_screen_results (N)
              ├─── watchlist_items (N)
              └─── sector_picks.leader (N)

  ai_artifacts ─── (无外键，通过 kind + primary_key 逻辑关联)
  sector_picks ─── (通过 trade_date 与 ai_artifacts 关联)
  news_items   ─── (独立)
  market_calendar ─── (独立)
  invite_codes ─── (独立)
```

## 写入路径总览

| 表 | 来源 |
|----|------|
| `profiles` / `long_lived_tokens` / `audit_logs(kind=login-*)` | Vercel Route Handler（service_role） |
| `watchlist_items` | Vercel Route Handler（走 RLS，使用用户 session） |
| `stocks` / `stock_daily` / `stock_screen_results` / `news_items` / `ai_artifacts` (批量) / `sector_picks` / `market_calendar` / `audit_logs`(大部分) | Sealos Scheduler（service_role） |
| `ai_artifacts` (kind=stock-intro/stock-analysis) | Vercel Route Handler 按需生成（service_role） |

## State transitions

**User 生命周期**:

```text
(no row) ──register──> profiles(active) ──login──> session + optional long_lived_token
                                                     │
                                                 logout
                                                     │
                                                     v
                                          session + token revoked
```

**ai_artifacts 生命周期**（以 midday 为例）：

```text
 (no row) ──成功生成──> INSERT v1 (generated_at=t1)
                      ──次日再次生成成功──> INSERT v2 (generated_at=t2)
                      ──某次生成失败──> 不写入（前端继续读 v2）
                      (v1 保留在表中便于审计)
```

## Storage footprint 估算

| 表 | 行数 | 单行大小 | 总量 |
|----|------|--------|------|
| `stocks` | ~5,500 | 200 B | ~1.1 MB |
| `stock_daily` | ~330,000 | 150 B | ~50 MB |
| `stock_screen_results` | ~2,400（60d × 2kind × 20） | 300 B | ~0.7 MB |
| `news_items` | ~3,500（7d × 500） | 2 KB | ~7 MB |
| `ai_artifacts` | ~2,000/年 + stock-intro 30 天缓存 | 2 KB | ~4 MB/年 |
| 其它 | - | - | <1 MB |

**总估算**：稳定期数据库占用 ~65 MB，远低于 Supabase Free 层 500 MB 上限。
