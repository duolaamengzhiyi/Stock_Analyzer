# Progress Memo — Stock Analyzer Final

**Updated**: 2026-05-25  
**Branch**: `001-initialization`  
**Git user prefix**: `violet`  
**Purpose**: Compact project state so future agents can resume without relying on chat history.

## Current State

- Repository has been initialized with Spec Kit artifacts and project constitution.
- Active feature is `001-initialization`, registered in `.specify/feature.json`.
- Working direction: build a Next.js stock analysis website with Vercel + Supabase + Sealos.
- **AI engine**: DeepSeek LLM (OpenAI-compatible API at `https://api.deepseek.com/v1`).
- The user chose **方案 A** after planning: first complete external platform setup steps from `quickstart.md` stages `[1]`, `[3]`, `[4]`, then return for `/speckit-tasks`.

## Important Commits

- `d534c4d` — Constitution v1.2.0, added Zustand system-store principle.
- `50bef43` — Initial feature spec + checklist + 9 clarify decisions.
- `3bcefb2` — Plan Phase 0/1 outputs: `plan.md`, `research.md`, `data-model.md`, `contracts/*`, `quickstart.md`, Cursor rules.

## Main Artifacts

- `specs/001-initialization/spec.md`
  - Full feature spec, 12 user stories, functional requirements, success criteria, assumptions.
  - Contains `## Clarifications` session with 9 decisions.
  - AI engine: **DeepSeek LLM** (FR-051, Assumptions).
- `specs/001-initialization/checklists/requirements.md`
  - Spec quality checklist, all items passed.
- `specs/001-initialization/plan.md`
  - Technical plan, constitution check PASS, post-design re-check PASS.
- `specs/001-initialization/research.md`
  - 18 technical decisions with rationale and alternatives.
  - R8/R15/R18: DeepSeek API, env vars, prompt builders.
- `specs/001-initialization/data-model.md`
  - 11 business tables, Drizzle schema outline, RLS strategy.
- `specs/001-initialization/contracts/`
  - `web-api.md`
  - `sealos-jobs.md`
  - `realtime-events.md`
- `specs/001-initialization/quickstart.md`
  - Beginner-oriented deployment guide for DeepSeek, Vercel, Supabase Integration, Sealos, first backfill.
- `.cursor/rules/specify-rules.mdc`
  - Generated agent context from plan.

## Architecture Decisions

- Vercel hosts Next.js App Router user-facing web app.
- Supabase is created through **Vercel Supabase Integration**, not directly first.
- Supabase provides Postgres, Auth, RLS, and Realtime.
- Sealos hosts:
  - AKTools service from `akfamily/aktools:latest`.
  - Python FastAPI + APScheduler scheduler service.
- Scheduler handles:
  - Initial 60 A-share trading-day backfill.
  - 11:30 and 15:15 stock data pulls.
  - CLS news pulls.
  - DeepSeek-generated midday/evening/forecast/news summaries.
  - Sector picks.
  - Market calendars.
  - Cleanup.
  - Realtime broadcasts.
- Dashboard refresh uses **Supabase Realtime Broadcast**, not client polling.
- Client state uses one root Zustand store with slices, per constitution.
- Auth uses Supabase Auth with placeholder email `{username}@stock-analyzer.local`.
- NextAuth was evaluated and rejected because it conflicts with constitution/Supabase RLS integration.

## DeepSeek Integration (2026-05-25 migration from Kimi)

- **Platform**: https://platform.deepseek.com
- **Base URL**: `https://api.deepseek.com/v1`
- **Default model**: `deepseek-v4-flash` (**1M** context per official API docs);
  optional `deepseek-v4-pro` for higher quality. Legacy aliases `deepseek-chat` /
  `deepseek-reasoner` deprecated 2026-07-24.
- **Code paths** (planned, not yet implemented):
  - `lib/deepseek/client.ts`, `lib/deepseek/prompts.ts`
  - `sealos/scheduler/clients/deepseek.py`
- **Env vars** (Vercel): `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_STOCK_INTRO`, `DEEPSEEK_MODEL_STOCK_ANALYSIS`
- **Env vars** (Sealos): `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_MIDDAY`, `DEEPSEEK_MODEL_EVENING`, `DEEPSEEK_MODEL_FORECAST`, `DEEPSEEK_MODEL_NEWS_SUMMARY`

## Clarify Decisions Embedded In Spec

1. Sector granularity: concept/topic boards via AkShare `stock_board_concept_*`.
2. Watchlist: no hard limit, virtual scrolling, soft warning at 200 items.
3. Account deletion/data export: out of scope for MVP; later admin feature.
4. Login brute-force protection: no lockout/rate-limit in MVP; unified error + audit logs.
5. A-share holiday banner dismissal: Asia/Shanghai natural-day boundary.
6. Initial data: first production launch backfills latest 60 A-share trading days.
7. Username: `^[A-Za-z0-9_-]{3,20}$`, stored lowercase.
8. Dashboard updates: Supabase Realtime push + manual refresh; no client timer polling.
9. Dashboard card layout: fixed, no per-user visibility/order/size preferences.

## Constitution Notes

- Constitution version is `1.2.0`.
- Added Principle 7: Zustand unified client state.
- Key hard constraints:
  - Next.js + React + TypeScript strict.
  - Tailwind only.
  - PostgreSQL via Supabase + Drizzle migrations.
  - Supabase Auth default.
  - shadcn/ui + Magic UI only for UI primitives/effects.
  - Vitest TDD required.
  - Zustand is the only client global state solution.

## User Action Plan Chosen

User chose **方案 A**:

1. User completes `quickstart.md` stages `[1]`, `[3]`, `[4]` now:
   - Register/confirm GitHub, Vercel, Supabase, Sealos, DeepSeek.
   - Create DeepSeek API key but **do not paste it into chat**.
   - Create Vercel project from GitHub repo.
   - Install Supabase Integration from Vercel.
   - Create Supabase project through Vercel Integration.
   - Disable Supabase Auth email confirmation.
2. After user returns with these done, proceed to `/speckit-tasks`.
3. Implementation should later use `/speckit-implement`.

## User-Facing Guidance Already Given

User should report back like:

```text
[1] DeepSeek key 已拿到
[1] Vercel / Supabase / Sealos 账号都注册好了
[3] Vercel 项目已建好，地址：https://xxx.vercel.app
[4] Supabase Integration 已安装，环境变量已自动注入
[4.4] Email confirm 已关闭
```

Important cautions:

- DeepSeek API key must not be pasted into chat.
- First Vercel deploy may fail because app code is not implemented yet; this is expected.
- Supabase project should be created from Vercel Integration.
- Supabase Email Confirm must be disabled for placeholder-email auth to work.

## Next Best Step

If the user reports platform setup completion, run `/speckit-tasks` next.

Expected `/speckit-tasks` should generate task list from:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/*`
- `quickstart.md`

Likely high-level task phases:

1. Bootstrap Next.js app and tooling.
2. Set up Drizzle schema/migrations/RLS.
3. Implement Supabase Auth registration/login/logout.
4. Implement Zustand root store and slices.
5. Implement dashboard layout and Magic UI/shadcn components.
6. Implement watchlist with search/drag/virtualization.
7. Implement Scheduler on Sealos.
8. Implement AKTools/DeepSeek integrations.
9. Implement Realtime events.
10. Add tests according to constitution.

## Current Caveat

This memo was updated after Kimi → DeepSeek migration (2026-05-25).
Still before `/speckit-tasks`. Run `git status` before making new changes.
