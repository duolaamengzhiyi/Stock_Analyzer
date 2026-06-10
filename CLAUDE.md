# stock-analyzer-final Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-24

## Active Technologies

- TypeScript 5.6 (Vercel Next.js 侧 strict 模式) + Python 3.12 (Sealos Scheduler 侧) + Next.js 15 (App Router), React 19, Tailwind CSS 3.4, shadcn/ui, Magic UI (MagicCard / Number Ticker / Marquee / Bento Grid), Zustand 5, Drizzle ORM, @supabase/supabase-js, @supabase/ssr (SSR 会话), next-nprogress-bar, @dnd-kit/core & @dnd-kit/sortable (自选股拖拽), @tanstack/react-virtual (虚拟滚动), lucide-react (图标)；Python 侧：FastAPI, httpx, supabase-py, apscheduler, openai (指向 DeepSeek 兼容端点) (001-initialization)

## Project Structure

```text
src/
tests/
```

## Commands

cd src && pytest && ruff check .

## Code Style

TypeScript 5.6 (Vercel Next.js 侧 strict 模式) + Python 3.12 (Sealos Scheduler 侧): Follow standard conventions

## Recent Changes

- 001-initialization: Added TypeScript 5.6 (Vercel Next.js 侧 strict 模式) + Python 3.12 (Sealos Scheduler 侧) + Next.js 15 (App Router), React 19, Tailwind CSS 3.4, shadcn/ui, Magic UI (MagicCard / Number Ticker / Marquee / Bento Grid), Zustand 5, Drizzle ORM, @supabase/supabase-js, @supabase/ssr (SSR 会话), next-nprogress-bar, @dnd-kit/core & @dnd-kit/sortable (自选股拖拽), @tanstack/react-virtual (虚拟滚动), lucide-react (图标)；Python 侧：FastAPI, httpx, supabase-py, apscheduler, openai (指向 DeepSeek 兼容端点)

<!-- MANUAL ADDITIONS START -->

## SpecKit 工作流

### tasks 执行节奏

- **按阶段（phase）分批执行**：tasks.md 中通常划分为 Setup / Foundational / User Story 1..N / Polish 等阶段，每完成一个阶段就停下来，向我汇报本阶段产出与遗留问题，等我确认后再进入下一阶段。
- **禁止一口气跑完整个 tasks.md**：即使任务彼此独立、可并行，也不得跨阶段连续推进。阶段是检查点，不是建议。
- **阶段内允许并行**：阶段内部标注 `[P]` 的任务可并发处理，但不得越过阶段边界把后续阶段的任务一并执行。
- **阶段切换前的最小汇报**：本阶段完成的任务编号、产出文件、未完成 / 跳过的任务及原因、需要我决策的事项。

<!-- MANUAL ADDITIONS END -->
