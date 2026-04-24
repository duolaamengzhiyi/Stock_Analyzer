<!--
同步影响报告 (Sync Impact Report)
================================
版本变更: 1.1.2 → 1.2.0
升级原因: MINOR 级改动 —— 新增原则七"客户端状态与 Zustand 统一
管理"，明确项目必须存在一个系统级根 store，按模块划分 slice，
跨路由保留状态，并把需要复用的请求结果纳入 Zustand 的缓存体系
（带 TTL / 失效策略）。同时在"技术栈与约束"章节把 Zustand 固化
为唯一的客户端状态管理库。属于新增原则，按 SemVer 为 MINOR。

新增原则:
- 七、客户端状态与 Zustand 统一管理

修改章节:
- 技术栈与约束 —— 新增"客户端状态管理"条目，指定 Zustand
  为唯一方案，并明确其与 React Server Component / Drizzle 的边界。
- 开发流程与质量门禁 —— 合并前检查 (f) 新增 store 相关项。

---- 历史 (保留于文件内以便追溯) ----
v1.1.2 (1.1.1 → 1.1.2, PATCH):
  在原则五"交互即时反馈"规则下，追加第 (d) 种落地手段：页面顶部
  全局加载进度条（nprogress / next-nprogress-bar），用于跨路由 /
  跨区域的长耗时请求，作为 useTransition / useOptimistic /
  显式 pending-disabled 态之外的补充选择。
v1.1.1 (1.1.0 → 1.1.1, PATCH):
  强化原则五"对用户交互必须立即响应"的硬性要求，禁止"点击后 UI
  无任何变化、仅后台静默请求"的反模式；在原则二新增对应的
  pending 态测试要求，使该约束可被 Vitest + @testing-library
  自动验证。

删除章节: 无

模板同步状态:
- ✅ .specify/memory/constitution.md（本文件）
- ⚠ .specify/templates/plan-template.md —— Constitution Check 需
  新增一条："状态放置决策"：本改动引入的跨组件 / 跨路由状态是否
  走了系统级 Zustand store？是否定义了缓存 key 与失效策略？
- ⚠ .specify/templates/tasks-template.md —— 涉及新模块的用户故事，
  应默认生成 "stores/<module>Slice.ts + 对应 Vitest 单元测试"
  子任务。
- ✅ .specify/templates/spec-template.md —— 无需改动（spec 层不规约
  状态管理细节）。
- ⚠ README.md —— 建议在"技术栈"段落里补一句 Zustand；暂不强制。

延期事项: 无。文件中不再留有未解释的方括号占位符。
-->

# Stock_Analyzer 项目宪法

## 核心原则

### 一、组件与样式复用优先

任何出现超过一次的视觉模式或行为模式，在其第二次使用被合入之前，
**必须** 先抽取为可复用单元。通用的 UI 构件以带类型的 React 组件形式
放在共享目录下（例如 `components/ui`、`components/shared`）；重复出现的
Tailwind 类组合 **必须** 通过 `cva`、`tailwind-variants`、共享样式 token
或 utility 组合进行收敛，**禁止** 直接复制粘贴。与渲染无关的业务逻辑
**必须** 抽离为 Hook 或纯工具模块，使其能被任何页面或组件直接导入。

理由：在 Next.js + Tailwind 项目中，重复代码是视觉漂移、回归风险和
维护成本的首要来源。在"第二次使用"时强制抽取，可以让设计系统保持
一致，后续重构成本极低。

### 二、测试驱动开发（不可妥协）

所有生产代码 **必须** 使用 Vitest 遵循 "红 → 绿 → 重构" 循环：

1. 先写一个会失败的 Vitest 测试（单元测试、组件测试，或基于
   `@testing-library/react` / Route Handler 的集成测试），用断言描述
   即将引入的行为。
2. 确认该测试以预期的原因失败。
3. 只写恰好能让测试通过的最小实现。
4. 在测试保持绿色的前提下进行重构。

任何功能任务、Bug 修复或重构在合入之前，**必须** 附带至少一个能在
原有代码上失败的测试。仅靠 snapshot 测试 **不能** 满足本条原则；
断言 **必须** 描述可观测的行为或契约。CI **必须** 运行 `vitest`，
测试不通过即阻止合并。

**测试优先级与边界**（用于指导"该测什么 / 不该测什么"）：

- **最优先**：业务逻辑函数、自定义 Hook（`hooks/` 下的所有
  `useXxx`）、API 路由 / Route Handler / Server Action 以及
  Drizzle 查询封装函数。它们 **必须** 有直接的单元测试或集成测试。
- **UI 组件**：只测"用户交互引发的状态变化与可观测输出"
  （例如点击后文本变更、表单校验错误文案、受控 Dialog 的开合、
  列表过滤结果）。**不要** 编写等同于测试 shadcn / Radix / Magic UI
  等第三方库基础功能的用例（如 Button 是否能被点击、Dialog 是否
  能打开这类由库本身保证的行为）。
- **交互即时反馈（闭环原则五）**：凡触发异步请求或状态变化的
  按钮、表单、切换控件，**必须** 至少有一个 Vitest 测试在交互
  刚发生的那一帧断言可见的 pending 态（例如
  `expect(button).toBeDisabled()`、`expect(screen.getByRole('status'))
  .toBeInTheDocument()`、乐观 UI 的新值已经出现在 DOM 等）。
  这类测试是原则五"交互即时反馈"规则能否被自动化验证的唯一手段。
- **React Server Component (RSC)**：优先把可测部分抽成纯逻辑函数
  或数据加载函数并对它们做单元测试；RSC 本身作为薄的组合层，
  **不要求** 一定渲染测试。
- **难以单元测试的复杂交互**：当组件依赖网络请求或外部 API 时，
  **必须** 使用 Mock Service Worker (MSW) 在测试中拦截并模拟
  HTTP / fetch 响应，而不是手工 mock `fetch` 或绕过请求层。

理由：本项目混合了 Server Component、Client Component、数据库访问
以及第三方 UI 库，边界众多。把测试重心放在"自己写的逻辑"上，
而不是重测第三方库，可以在保持高覆盖有效性的同时，避免测试代码
本身成为维护负担。

### 三、移动端与桌面端体验一致

每一个页面与每一个非平凡组件，**必须** 同时在移动端断点
（≤ `sm`，默认 640 px）和桌面端断点（≥ `lg`，默认 1024 px）下完成
设计与验证。布局 **必须** 采用 Tailwind 响应式前缀、以 mobile-first
的方式构建；**禁止** 固定像素宽度、横向溢出以及仅依赖 hover 的
桌面专属交互（这类交互必须同时提供可点击/可触达的等价实现）。
信息层级、主操作和数据密度在不同断点下 **必须** 保持一致；
若要在移动端隐藏桌面端的某项功能，**必须** 有明确且已记录的
产品决策。

理由：股票数据在手机上被查看的频率并不低于桌面。强制双端一致可以
避免"移动端在上线后变成二等公民"这一常见退化。

### 四、受控的组件库 (shadcn + Magic UI)

所有通用 UI 原语（Button、Input、Dialog、Table、Card 等）**必须**
来自 shadcn/ui，并统一放在 `components/ui` 下，以便集中审核与主题化。
Magic UI **可以** 用于局部的视觉增强 —— 动画标题、图表、背景、
徽章、过渡等 —— 前提是这些效果能切实提升感知质量。引入任何其他
第三方 UI 库 **必须** 通过宪法修订流程；**禁止** 临时从其它组件库
零散地引入组件。项目内自研的原语 **必须** 遵循 shadcn 的约定
（适用时使用 Radix 作为底层、使用 `cn()` 工具、通过 `cva` 定义
variant），做到与生成出来的 shadcn 组件无法区分。

理由：保持单一的组件词汇表，能让可访问性、主题和深色模式行为
天然一致。Magic UI 被明确限定在"锦上添花"层，避免组件库膨胀。

### 五、性能与响应感知

任何路由与可交互组件 **必须** 在用户输入后 100 ms 内给出可见反馈，
**严禁** 在尚未就位的数据上阻塞主线程，**严禁** 出现"点击/提交后
UI 毫无变化、仅后台静默加载"的反模式 —— 用户触发的每一次交互
都必须第一时间在界面上"看得见"。本原则通过以下硬性规则落地：

- **交互即时反馈（最高优先级）**：每一次用户交互（点击、提交、
  切换、过滤、排序等）**必须** 在同一帧内给出可观测的视觉变化。
  具体落地方式至少选其一：
  (a) 使用 `useTransition` 包裹异步处理函数，期间展示
      pending 骨架屏 / 占位；
  (b) 使用 `useOptimistic` 立即更新本地状态，再在后台对齐服务端
      结果；
  (c) 显式把触发控件切到 `disabled` + loading 态（例如按钮出现
      spinner、`aria-busy="true"`）；
  (d) 在页面顶部挂载全局加载进度条（例如 `nprogress`、
      `next-nprogress-bar` 等），用于跨路由 / 跨区域的长耗时请求，
      让用户在 **任意位置** 都能看到"系统正在工作"。
  **禁止** 只在处理函数里 `await fetch(...)` 却不同步更新任何可见
  状态；评审者和测试都 **必须** 能在交互后的首帧观察到界面变化。
- 默认使用 React Server Component；仅当确实需要交互或浏览器 API 时
  才添加 `"use client"`。
- 任何异步边界（数据请求、动态导入、含 Suspense 的子树）**必须**
  被 `<Suspense>` 包裹，并搭配专门绘制的骨架屏 (skeleton) 或
  `loading.tsx`，**禁止** 在空白页面上只放一个 spinner。
- 路由切换 **必须** 使用 Next.js 的 `loading.tsx` 文件，和/或
  乐观 UI（`useOptimistic`、`useTransition`），保证导航永远不会
  显得"卡住"。
- Client Component 在性能剖析或渲染审查显示存在浪费时，**必须**
  合理使用 `React.memo`、`useMemo`、`useCallback`、`useDeferredValue`
  等记忆化原语；但仍然反对在无证据的前提下过早优化。
- 图片 **必须** 使用 `next/image`；较重的纯客户端模块 **必须** 通过
  `next/dynamic` 加载，并提供骨架屏占位。
- Server Component 访问数据库 **必须** 经由 Drizzle，并使用预编译 /
  参数化查询；N+1 查询模式视为阻塞性问题。

理由：只有 UI 永远不显得停滞，股价数据才会给人"实时"的感觉。
将 Suspense、骨架屏和过渡相关原语设为强制项，可以填平数据延迟
与用户感知之间的鸿沟。

### 六、关键步骤与复杂逻辑的简要注释（面向新手）

本项目的主要维护者是新手开发者，因此代码 **必须** 在以下位置
附带 **简短** 的中文或英文注释，帮助后续阅读者快速建立心智模型：

- 文件 / 模块顶部：一两句话说明该文件 **为什么** 存在、对外暴露
  什么能力（不要重复文件名）。
- 非显而易见的业务规则、算法、边界条件处理（例如股票停牌、
  时区转换、涨跌幅计算口径等）。
- 跨越 Server / Client 边界的代码（`"use client"`、Server Action、
  Route Handler 入口），标注运行环境与身份校验假设。
- 任何使用 `any`、非空断言 `!`、`@ts-expect-error` 或
  `eslint-disable` 的位置，**必须** 在行内或上一行写明理由。
- 较长的自定义 Hook 或复杂 `useEffect`：用一句话说明它的职责、
  依赖为何如此选择、是否刻意省略依赖。

同时遵循以下 **禁止项**，避免注释噪音：

- **禁止** "翻译代码字面意思"的注释（例如 `// 把 count 加 1`、
  `// 导入 React` 这种废话）。
- **禁止** 用注释描述本次改动的 diff；变更原因写进 commit message
  或 PR 描述，而不是代码里。
- 注释应 **尽量短**，一行能讲清就不要写两行；需要长篇解释时，
  把文字放进 `README`、`docs/` 或代码对应的文档字符串，而不是
  堆在业务代码中。

理由：在 Next.js + Server Component + Drizzle + Supabase 这类
涉及多层边界的架构里，"哪段代码在哪里执行、对谁可见、在什么
前提下成立"往往不能从语法本身看出来。对新手来说，几行关键注释
就能替代数小时的溯源成本；同时通过"禁止项"防止注释退化为噪音。

### 七、客户端状态与 Zustand 统一管理

所有跨组件、跨路由共享的客户端状态 **必须** 使用 Zustand 管理。
**禁止** 以 `useState` + React Context 的组合自造全局状态层，
**禁止** props drilling 超过两层时仍不收敛到 store，
**禁止** 在 `"use client"` 组件内部调用 `create()` 创建临时 store
（每次挂载都会被重置，违背本原则的初衷）。

本原则通过以下硬性规则落地：

- **系统级根 store（唯一）**：项目 **必须** 存在且仅存在一个系统级
  根 store（推荐路径：`stores/useAppStore.ts`）。该 store 通过组合
  多个模块化 slice 构成（例如 `watchlistSlice`、`filterSlice`、
  `uiSlice`、`cacheSlice` 等），每个 slice 独立一个文件，
  按 `(set, get) => ({...})` 的 slice pattern 实现，在根 store 中
  通过展开合并。新增业务模块 **必须** 以新建 slice 的方式接入，
  **禁止** 为同一应用创建多个并列的根 store。
- **跨路由状态留存**：Zustand 的 store 是 module-level singleton，
  切换路由时默认保留状态；因此需要跨路由保持的筛选条件、视图偏好、
  已加载数据等 **必须** 写入 store，而不是写在页面组件的本地
  `useState` 里。
- **请求结果缓存**：对重复请求的接口数据（行情、K 线、用户配置等），
  **必须** 在根 store 下的 `cacheSlice` 中以
  `{ data, fetchedAt, status, error }` 的结构缓存，并为每个缓存条目
  定义：
  (a) **缓存 key**（含所有影响结果的参数，例如
      `quote:${symbol}:${interval}`）；
  (b) **TTL 或显式失效事件**（例如行情 30s TTL、用户配置在"保存
      成功"事件后手动 `invalidate`）。
  读取数据的 Hook **必须** 走"先查缓存 → 命中且未过期直接返回 →
  未命中或过期则发起请求并写回缓存"的统一路径，**禁止** 组件各自
  手写 fetch + 局部缓存。
- **持久化**：需要跨会话保留的状态（自选股、主题、侧栏收起状态等）
  **必须** 使用 Zustand 官方 `persist` middleware，并通过
  `partialize` 明确列出被持久化的字段，**禁止** 把整个 store 无差别
  序列化进 `localStorage`（避免撑大存储、泄漏敏感字段、或把瞬时
  状态写死）。请求缓存 **默认不** 持久化，除非该缓存本身属于用户
  长期数据。
- **与 Server Component 的边界**：Server Component **禁止** 直接
  订阅或写入 Zustand store（服务端不存在浏览器单例，读到的是
  空状态）。跨边界的数据流向 **必须** 是：Server Component 通过
  props 把数据交给 Client Component，由 Client Component 再写入
  store；Server Action 的返回值也同理。
- **SSR / Hydration 安全**：使用 Next.js App Router 时，持有
  `persist` middleware 的 store **必须** 在组件读取前完成
  hydration 检查（例如先订阅 `onFinishHydration` 或返回占位），
  避免首屏服务端渲染与客户端恢复的状态不一致导致的 hydration
  mismatch。
- **可测试性（闭环原则二）**：每一个 slice 的 action **必须** 有
  Vitest 单元测试，通过直接调用 store 的 `getState()` /
  `setState()` 断言状态转移；涉及异步 action 的 slice **必须**
  配合 MSW 模拟 HTTP 响应，而非手工 mock `fetch`。
- **选择器（selector）规范**：组件订阅 store 时 **必须** 使用
  细粒度 selector（例如 `useAppStore((s) => s.watchlist.items)`）
  而非 `useAppStore((s) => s)`，配合 `shallow` 比较函数，避免无关
  字段变更引发整棵子树重渲染 —— 这同时是原则五（性能）的具体
  落地。

理由：本项目是以股票数据为核心的多视图应用，用户会在行情、自选、
对比、详情等页面之间频繁切换；如果每个页面都从本地 `useState` 重新
请求并丢弃数据，体验会非常断裂。通过"一个系统级根 store + 模块化
slice + 统一请求缓存"，既能让切换路由后状态原样保留，也能把重复
请求收敛到缓存层，显著降低网络抖动与延迟带来的感知卡顿；对新手
维护者而言，"客户端状态去哪儿找"这个问题也有了唯一答案。

## 技术栈与约束

下列技术栈对本项目具有规范性。偏离这些约束 **必须** 走宪法修订流程
（见治理章节）。

- **框架**：Next.js（App Router）+ React + TypeScript。所有新代码
  **必须** 使用 TypeScript 并启用 `strict` 模式；`any` 与非空断言
  (`!`) 必须附带行内理由注释。
- **样式**：Tailwind CSS 是唯一的样式系统。全局 CSS 仅限于 reset、
  字体加载，以及支撑 Tailwind 主题的 CSS 自定义变量。**禁止**
  使用 CSS-in-JS 库。
- **数据层**：PostgreSQL 作为唯一事实源，通过 Drizzle ORM 访问。
  由 Supabase 托管 Postgres 实例、认证，以及（按需启用的）
  Realtime 与存储能力。任何 schema 变更 **必须** 作为 Drizzle
  migration 提交到仓库；**禁止** 在生产环境直接执行不在 migration
  文件中的 SQL。
- **认证与授权**：默认使用 Supabase Auth。所有对客户端暴露的表
  **必须** 定义 Row-Level Security 策略；Server Action 与 Route
  Handler **必须** 重新校验调用方身份，不得直接信任客户端传入的 ID。
- **UI 组件**：主用 shadcn/ui，辅以 Magic UI 做局部特效。图标
  **建议** 使用 `lucide-react`，以匹配 shadcn 默认值。
- **客户端状态管理**：Zustand 是唯一的客户端全局状态方案，落地形式
  参见原则七：一个系统级根 store（`stores/useAppStore.ts`），按模块
  划分 slice，通过 `persist` middleware 选择性持久化，通过
  `cacheSlice` 统一承担请求结果缓存。**禁止** 引入 Redux、Jotai、
  Recoil、MobX 等其他全局状态库；**禁止** 用 Context + `useReducer`
  自造等价设施。服务端数据的一次性读取仍然优先走 Server Component
  + Drizzle，只有在"需要跨路由留存、跨组件共享、或需要客户端缓存"
  时才进入 Zustand。
- **测试**：Vitest 是唯一的测试运行器，组件测试搭配
  `@testing-library/react`；真正的端到端流程可按需选用 Playwright。
  测试文件放在被测代码旁边（`*.test.ts(x)`）或统一的 `tests/` 目录下。
- **密钥与配置**：环境变量遵循 Next.js 规约；仅以 `NEXT_PUBLIC_`
  前缀的变量才可暴露给浏览器。Supabase 的 service-role key
  **严禁** 进入任何客户端 bundle。

## 开发流程与质量门禁

- **Spec-Kit 流程**：所有非琐碎的功能 **必须** 走
  `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` →
  `/speckit.implement` 全流程。`/speckit.plan` 中的 Constitution Check
  **必须** 针对本宪法的 **七条** 原则逐条给出评估结论；出现违反
  时必须在 plan 的 Complexity Tracking 中登记理由。
- **分支与提交**：新功能在由 `/speckit.git.feature` 创建的分支上
  进行。提交 **应当** 粒度小、可通过测试，并使用 git 扩展提供的
  auto-commit 钩子。
- **合并前检查**：PR 可以合并的充要条件是：
  (a) `vitest` 绿；
  (b) `tsc --noEmit` 无错；
  (c) 项目的 lint / format 命令无错；
  (d) 对任何可见的 UI 变更，至少有一位人类评审者确认了移动端 +
  桌面端截图或 Loom 录屏；
  (e) 新组件已确认尽可能复用现有原语；
  (f) 新增或修改 Zustand store / slice 时，已附带对应的 Vitest
  单元测试，且组件侧使用了细粒度 selector（不存在
  `useAppStore((s) => s)` 这类整树订阅）。
- **性能评审**：任何新增路由、顶层数据请求，或较重客户端依赖的 PR，
  **必须** 在描述中简述其 Suspense / 骨架屏策略；对较重的客户端改动，
  **必须** 给出 bundle 体积的估算或实测。
- **数据库变更**：任何涉及 schema 的 PR，**必须** 同时包含生成的
  Drizzle migration 与更新后的 schema 文件；评审者 **必须** 核对
  新增的表是否都配置了 RLS 策略。

## 治理

本宪法优先于任何临时约定与个人偏好。所有 Pull Request、设计评审、
以及自动化 Agent 的动作，在获得批准前 **必须** 验证是否符合上述
原则。当某条原则看起来会阻碍必要的工作时，作者 **必须** 二选一：
(a) 在 plan 的 Complexity Tracking 中论证该偏离并取得评审者明确
同意，或 (b) 提交一次宪法修订。

修订流程如下：

1. 提交一个 PR 修改 `.specify/memory/constitution.md`，并附带新的
   Sync Impact Report（同步影响报告）。
2. 同步更新影响报告中列出的所有模板与运行时指引文档；若暂不更新，
   **必须** 在报告中明确标注为延期项。
3. 按下列 SemVer 规则升版本：
   - **MAJOR**：不向后兼容的原则或治理规则的删除 / 重定义。
   - **MINOR**：新增原则 / 章节，或显著扩展的指导内容。
   - **PATCH**：措辞澄清、拼写修正、非语义改动（例如翻译）。
4. 至少获得一位 maintainer 的批准后合入。`Ratified` 日期在修订时
   **不** 变化；只有 `Last Amended` 会前移。

面向贡献者与 AI Agent 的运行时指引位于 `README.md`、
`.cursor/skills/` 目录以及 Spec-Kit 工作流模板中。上述文档 **必须**
与本宪法保持一致；如发生冲突，在它们被更新之前，以本文件为准。

**版本**: 1.2.0 | **批准日期 (Ratified)**: 2026-04-22 | **最近修订 (Last Amended)**: 2026-04-22
