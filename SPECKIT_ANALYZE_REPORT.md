# Specification Analysis Report — 001-initialization

**状态**: ✅ 已处理（2026-06-09，全部 12 项 finding 已修订入 spec / plan / tasks / contracts）
**生成时间**: 2026-06-09
**分析范围**: `specs/001-initialization/{spec.md, plan.md, tasks.md}` + `.specify/memory/constitution.md`
**操作模式**: 只读分析（本报告本身未修改），下方修订已应用到对应 artifact

---

## Findings 总表

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **I1** | Inconsistency / Constitution | **CRITICAL** | tasks.md T064 ↔ spec.md FR-002 / FR-009 / Assumptions「认证库选型」/ US1 | T064 写"账号名 → 占位邮箱 `{username}@stock-analyzer.local`"作为 Supabase Auth 注册凭证；spec 明确要求"用户真实邮箱作为 Supabase Auth 主登录凭证，开启 Confirm email"。占位邮箱方案直接绕过 FR-009 邮箱确认（占位地址收不到验证邮件），并与 US1 Acceptance Scenarios 3「Supabase 发送确认邮件 → 用户点击确认链接」彻底冲突。 | 重写 T064：包装"真实邮箱 + 密码"流程（含 `signUp({email, password, options:{emailRedirectTo}})`）；账号名唯一性写入 `profiles` 表并由 T066 register handler 校验。修正后重跑 plan Constitution Check。 |
| **C1** | Coverage Gap | **HIGH** | spec.md FR-009 / plan.md `app/auth/callback/route.ts` | plan.md 在 Project Structure 中明确列出 `app/auth/callback/route.ts`「Supabase 邮箱确认回跳，交换 code 后建 session」；tasks.md 没有任何任务创建该路由，也没有任务对邮箱确认链接进行集成测试。FR-009 与 US1 的"点击确认链接进入 Dashboard"路径无落地点。 | 在 Phase 3 (US1) 新增任务：实现 `app/auth/callback/route.ts`（`exchangeCodeForSession` + 重定向到原始 `redirect` 或 `/dashboard`）。同步加测试任务。 |
| **C2** | Coverage Gap | **HIGH** | plan.md `lib/deepseek/client.ts` ↔ tasks.md T143 / T144 | plan.md Project Structure 列出 Vercel 侧 `lib/deepseek/client.ts` + `prompts.ts`；T143 / T144 调 DeepSeek SSE，但 tasks 仅在 sealos 侧（T053 / T124）创建 deepseek 客户端与 prompts，Vercel 侧的客户端封装无创建任务。结果是个股 AI 介绍 / 分析路径无可复用 client。 | Phase 2 Foundational 新增任务：创建 `lib/deepseek/client.ts`（OpenAI 兼容端点封装 + 流式）和 `lib/deepseek/prompts.ts`（stock-intro / stock-analysis 模板）。 |
| **C3** | Coverage Gap | **HIGH** | spec.md FR-054 ↔ tasks.md T139 / T165 | FR-054 要求"涵盖午评、晚评、未来预测、**新闻 AI 总结**、个股 AI 介绍、个股 AI 分析、**预测推荐**"全部展示双时间戳。tasks 仅在 T129（ai-commentary-card）与 T147（stock-ai-dialog）显式落实；T139（news-ai-summary）与 T165（sector-picks-card）没有提及 `generated_at` + `source_data_at` 显示要求。 | 在 T139 与 T165 描述中显式加入"页脚同时展示双时间戳（FR-054）+ 文字 + 视觉双编码过期标识（FR-055）"，并补充对应组件单测。 |
| **C4** | Coverage Gap | MEDIUM | spec.md FR-110 ↔ tasks.md | FR-110 要求"所有页面与非平凡组件 必须 在 sm/lg 两断点完成设计与验证"。tasks 仅在 T197 polish 阶段做"sm/lg 双断点抽查"，没有把"双断点验证"作为各 US 实现任务的硬约束。 | 在每个含 UI 的 US Phase（US1/US3/US4/US10/US11/US12）的最后一个组件接入任务里追加"sm 与 lg 双断点验证"checklist 项；或新增专门的响应式断点验收任务。 |
| **I2** | Inconsistency | MEDIUM | plan.md "Constitution Check / 原则七" | 行文先写"组合四个 slice"，后列出 5 个：`authSlice / watchlistSlice / cacheSlice / uiSlice / realtimeSlice`。计数与列表不一致。 | 改为"组合 5 个 slice"。 |
| **I3** | Inconsistency | MEDIUM | tasks.md Phase 2 引语"所有 11 张表 schema" | 实际 T017–T028 = 12 张 schema 文件（profiles / long-lived-tokens / invite-codes / stocks / stock-daily / stock-screen-results / watchlist-items / news-items / ai-artifacts / sector-picks / market-calendar / audit-logs）。 | 改为"所有 12 张表 schema"。 |
| **I4** | Inconsistency | LOW | plan.md "原则五 — 性能与响应感知" | 行文写"路由切换使用 `next-nprogress-bar` 顶部进度条（对应 FR-051d）"。FR-051 是"DeepSeek 作为生成引擎"，与 nprogress 无关；该括注应指宪法原则五的 (d) 落地手段。 | 改为"对应宪法原则五 (d)"。 |
| **C5** | Coverage Gap | LOW | plan.md `lib/aktools/client.ts` | plan 列出 Vercel 侧 `lib/aktools/client.ts`（"仅 Next.js 侧用到的轻量调用——股票搜索 name/code 查询"）；T114 实现 `/api/search/stocks` 但未创建该 client。若搜索改从 Supabase `stocks` 表查询，则 plan 描述应同步移除；若仍要走 AKTools，需补建任务。 | 二选一：① 删除 plan 中该条目（统一从 `stocks` 表搜索）；② 在 Phase 2 新增 `lib/aktools/client.ts` 任务并由 T114 引用。建议方案 ①。 |
| **C6** | Coverage Gap | LOW | spec.md FR-013（自选股跨设备一致） | 无显式测试；当前由 RLS + DB 持久化隐式覆盖。 | 在 T106 测试中追加一个用例："以同一用户 token 在两个 supabase client 实例下对自选股的读取结果一致"（断言跨会话一致）。 |
| **C7** | Coverage Gap | LOW | spec.md SC-002 / SC-010 / SC-013 | SC-002（注册 / 登录 → Dashboard 端到端 ≤ 3s）、SC-010（5 min P95）、SC-013（午晚评成功率 ≥ 95%）均无显式实测任务，仅在 T196 polish 阶段笼统记录。 | 在 T196 行末用清单方式列明每条 SC 的实测口径与采集来源（前端打点 / 审计日志统计）。 |
| **A1** | Ambiguity | LOW | spec.md FR-10A 编号 | FR 编号在 FR-106..FR-109 之后突然出现 `FR-10A`（混入字母），随后又跳到 `FR-110`，会让读者误以为 `FR-10A` 是别的体系。 | 重命名为 `FR-10A` → `FR-110`，并把当前 `FR-110`（响应式）顺延为 `FR-111`，或采用 `FR-110a/b/c/d/e` 的子项编号。 |

---

## Coverage Summary（仅列覆盖不完整的需求）

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-002 / FR-009（真实邮箱 + 邮箱确认） | ⚠ 部分 | T066 | T064 的占位邮箱方案与 FR 冲突（I1） |
| FR-009（邮箱确认回调） | ❌ 缺 | — | 缺 `app/auth/callback/route.ts` 任务（C1） |
| FR-013（跨设备自选一致） | ⚠ 隐式 | T106 | 无显式断言（C6） |
| FR-054（双时间戳全部 7 类卡片） | ⚠ 部分 | T129, T147 | news-ai-summary / sector-picks-card 缺（C3） |
| FR-110（sm/lg 双断点） | ⚠ 仅抽查 | T197 | 缺各 US 内的硬约束（C4） |
| Vercel 侧 `lib/deepseek/client.ts` | ❌ 缺 | — | C2 |
| Vercel 侧 `lib/aktools/client.ts` | ❌ 缺 | — | C5（取决于搜索方案） |
| SC-002 / SC-010 / SC-013 实测 | ⚠ 笼统 | T196 | C7 |

其余 ~52 条 FR 与 11 条 SC 均有明确任务覆盖，不再列出。

---

## Constitution Alignment Issues

- **认证库 = Supabase Auth（宪法《技术栈与约束 / 认证与授权》）**：宪法明确"默认使用 Supabase Auth + 邮箱确认 + RLS 联动"。tasks T064 的占位邮箱方案虽然仍调用 Supabase Auth，但实质上**关闭了邮箱确认能力**（占位邮箱不可达），违背宪法《认证与授权》条款的精神。**此项即 I1 升级为 CRITICAL 的根因。**
- 其他 6 条原则在 plan Constitution Check 中均已通过；本次 analyze 未发现新违规。

## Unmapped Tasks

未发现任务无法回溯到 FR / SC / 闭环原则；所有 199 条任务均能定位到至少一条 FR 或 plan 决策。

---

## Metrics

| 指标 | 数值 |
|------|------|
| Total Functional Requirements | 61（FR-001 … FR-125，含 FR-10A） |
| Total Success Criteria（buildable） | 24 |
| Total Tasks | 199 |
| Total User Stories | 12 |
| Coverage %（FR ≥1 mapped task） | ~95% |
| Ambiguity Count | 1 |
| Duplication Count | 0 |
| Critical Issues Count | **1**（I1） |
| High Issues Count | **3**（C1 / C2 / C3） |
| Medium Issues Count | 3（C4 / I2 / I3） |
| Low Issues Count | 5（I4 / C5 / C6 / C7 / A1） |

---

## Next Actions

### 必须在 `/speckit-implement` 之前修复

1. **I1**：重写 tasks T064，把"占位邮箱"改回真实邮箱方案；同步检查 T066 / T067 是否暗含占位邮箱的字段映射。
2. **C1**：新增 `app/auth/callback/route.ts` 任务（建议命名 T073a 或在 Phase 3 末尾追加）。
3. **C2**：在 Phase 2 Foundational 新增 `lib/deepseek/client.ts` + `lib/deepseek/prompts.ts` 任务（建议挂在 T053 之后，标记 [P]）。
4. **C3**：扩写 T139 / T165 描述使其涵盖 FR-054 双时间戳。

### 建议尽早处理（非阻塞但影响验收）

- **I2 / I3 / I4**：plan.md 与 tasks.md 计数与引用更正，可一起做一次小 PR。
- **C4**：把"sm/lg 双断点验证"作为各含 UI 任务的 Definition of Done 项写进任务描述。

### Polish 阶段处理

- **C5 / C6 / C7 / A1** 可推迟到 Phase 15。

### 建议命令

- 修订完 spec / plan / tasks 后，可重跑 `/speckit-analyze` 闭环验证。
- 若需 `/speckit-tasks` 重新生成 tasks.md，请先把上述修订写进 spec / plan，避免重生成时丢失人工修订。

---

## Remediation

如需我针对 **I1 + C1 + C2 + C3** 给出具体的修订条目（精确到 tasks.md / plan.md 的 diff 文本）以便一次性手工应用，请回复"输出修订片段"或指定哪几条。

---

## Changelog（2026-06-09 应用修订）

全部 12 项 finding 已按推荐方案落地，下方按 finding ID 列出实际改动位置；不再列具体行号（避免行号漂移），均可由文件内 `grep` 关键字定位。

| ID | 严重 | 改动文件 | 改动摘要 |
|---|---|---|---|
| **I1** | CRITICAL | `tasks.md` | 重写 T064 为真实邮箱 `signUp/signInWithPassword` + `exchangeCodeForSession`；T066 补邮箱校验/规范化、`profiles` 写入与 FR-009 提示；T067 补"邮箱未确认"分支；T057/T058 测试用例同步加入邮箱字段断言 |
| **C1** | HIGH | `tasks.md` | 新增 T062a（callback 路由集成测试）+ T073a（实现 `app/auth/callback/route.ts`，复用 T064 的 `exchangeCodeForSession` + `@supabase/ssr` 写 cookie + 审计日志）；US1 Checkpoint 补"邮箱确认链接点击后建立 session" |
| **C2** | HIGH | `tasks.md` | Phase 2 新增 T053a `lib/deepseek/client.ts`（OpenAI 兼容 SDK + SSE 包装）+ T053b `lib/deepseek/prompts.ts`（stock-intro / stock-analysis 模板） |
| **C3** | HIGH | `tasks.md` | T139（news-ai-summary）与 T165（sector-picks-card）显式追加 FR-054 双时间戳（`generated_at` + `source_data_at`）+ FR-055 文字 + 视觉双编码过期标识 |
| **C4** | MEDIUM | `tasks.md` | US1/US3/US4/US12/US11 各 Phase 末尾追加一条 sm/lg 双断点验证任务（T073b / T104a / T120a / T159a / T184a）；US10 既有 T181 已含双断点口径 |
| **I2** | MEDIUM | `plan.md` | 原则七描述："组合四个 slice" → "组合 5 个 slice" |
| **I3** | MEDIUM | `tasks.md` | Phase 2 引语："所有 11 张表 schema" → "所有 12 张表 schema" |
| **I4** | LOW | `plan.md` | 原则五描述："对应 FR-051d" → "对应宪法原则五 (d)" |
| **C5** | LOW | `plan.md` | 采用方案①：移除 Project Structure 中 `lib/aktools/client.ts` 条目（T114 直接走 `stocks` 表搜索） |
| **C6** | LOW | `tasks.md` | T106 追加 FR-013 跨会话一致性断言（同一 token 在两个 supabase client 实例下 `GET /api/watchlist` 结果在 `code` 与 `sortOrder` 上完全一致） |
| **C7** | LOW | `tasks.md` | T196 列出 SC-002 / SC-010 / SC-013 实测口径与采集来源（前端打点 + Performance API + `audit_logs` 统计 SQL） |
| **A1** | LOW | `spec.md` / `plan.md` / `contracts/realtime-events.md` / `tasks.md` | 采用方案③：FR-10A → FR-111（FR-110 响应式断点保持不变），共 6 处替换 |

### 任务计数变化

`tasks.md` 末尾任务总数：**199 → 208**（+9）

| 段 | 改动 |
|---|---|
| Foundational | 40 → 42（+T053a, T053b） |
| US1 | 17 → 20（+T062a, T073a, T073b） |
| US3 | 17 → 18（+T104a） |
| US4 | 16 → 17（+T120a） |
| US12 | 11 → 12（+T159a） |
| US11 | 3 → 4（+T184a） |

### 校验

- `grep -rn "FR-10A" specs/001-initialization .specify/memory` → 0 命中
- `grep -rn "占位邮箱\|stock-analyzer.local" specs/001-initialization` → 仅 `research.md` "被拒绝备选方案"章节保留 2 处作为决策审计记录（解释为何选真实邮箱方案）；spec / plan / tasks / contracts 内 0 命中
- 其余三层产物（spec / plan / tasks）相互引用一致，可直接进入 `/speckit-implement`
