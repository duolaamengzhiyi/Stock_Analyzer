# Specification Quality Checklist: Stock Analyzer Platform — Initialization

**Purpose**: 在进入 `/speckit.clarify` 或 `/speckit.plan` 之前，确认 spec
的完备性与质量。
**Created**: 2026-04-22
**Feature**: [../spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 备注：Spec 中出现了 MagicUI、Kimi LLM、AKShare、CLS、Sealos 等专有
    名称，但这些是 **用户显式约束的产品决策**（"必须用这个数据源 / 这个组件
    库"），属于业务约束范畴，不是实现细节。Tailwind / Next.js / Drizzle
    等项目级技术栈由宪法承载，不在 spec 重复。
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
  - 备注：面向"希望理解产品做什么"的审阅者写作，技术口径集中在 Assumptions
    并且给出量化而非代码。
- [x] All mandatory sections completed
  - User Scenarios & Testing、Requirements、Success Criteria、Assumptions
    四个必备章节均已填写。

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 备注：本次全部采用 Assumptions 记录合理默认。用户对"CLS 接口是否是
    `stock_telegraph_cls`"的提问与"筛选算法是否合理"的提问均已在
    Assumptions 段落以量化口径给出默认答案，未保留未决标记。
- [x] Requirements are testable and unambiguous
  - 每条 FR 均可通过"能否写出一个会 fail 的 Vitest / 集成测试"来验证。
- [x] Success criteria are measurable
  - SC-001 至 SC-062 均以时长 / 百分比 / 计数 / 可审计事件给出量化。
- [x] Success criteria are technology-agnostic (no implementation details)
  - 备注：SC 中提及的"Vitest 自动化"是**宪法强制的**验证手段，不是 spec
    自行引入的实现方案；其余 SC 以"用户可感知的耗时 / 比例"描述。
- [x] All acceptance scenarios are defined
  - 12 条用户故事均提供了 `Given / When / Then` 验收场景至少 3 组。
- [x] Edge cases are identified
  - Edge Cases 小节覆盖深链接回跳、邀请码大小写、会话劫持、停牌、清理与
    筛选时序、样本不足、LLM 越界、资源竞争、自选股退市、拖拽回滚，以及
    多市场节假日交叉、跨市场时区边界、交易日历陈旧、A 股休市日 AI 点评
    调度等。
- [x] Scope is clearly bounded
  - Assumptions 末尾明确列出"不在本次范围"的项（邮箱验证、多方登录、交易
    执行、管理后台）。
- [x] Dependencies and assumptions identified
  - Assumptions 章节已列出数据源、时区、数据规模、AI 引擎、MagicUI
    / shadcn 的前置条件。

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
  - 身份 / 抓取 / 筛选 / 自选 / AI 点评 / 新闻 / 个股弹窗 / 预测推荐 / 首页
    / Dashboard 布局 / 侧边栏 / 多市场休市状态——12 条故事覆盖用户描述中的
    全部模块。
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification
  - 仅保留了"产品级的技术约束"（因为这些是用户在描述中显式给出的不可变决策）。

## Notes

- 用户在自然语言描述中显式绑定了数据源（AKShare + AKTools via Sealos、
  财联社 CLS）、AI 引擎（Kimi）、以及 UI 库（shadcn + MagicUI 指定组件），
  这些已作为"产品级决策"进入 FR 与 Assumptions。若 Plan 阶段发现上游接口
  不可用 / 限额不达标，需要回到 spec 修订而不是在 plan 悄悄替换。
- "启动在即"与"主升浪"的算法阈值（振幅 15% / 单日 5% / 回归斜率 0.3%；
  窗口收益 3% / 正日 ≥ 3 / 单日回撤 ≥ -3%）属于**可调参数**；建议在
  `/speckit.clarify` 或 Plan 的 research.md 中讨论是否需要按用户偏好微调。
- 抓取调度、60 日 / 7 日滚动保留、AI 文本永久保留这三条是互相耦合的事务
  约束，Plan 阶段需要专门验证"先抓取 → 再清理 → 不影响 AI 引用"的时序。
- **2026-04-24 增补（多市场休市）**：新增 User Story 12（多市场休市状态提示
  + A 股休市数据回退）、FR-120~FR-125、SC-050~SC-052、Entity `MarketCalendar`，
  以及 4 条相关 Edge Case 与一节"关于多市场交易日历"的 Assumptions。五个
  覆盖市场为 A 股 / 美股 / 港股 / 日股 / 韩股；"当日"判定统一以 Asia/Shanghai
  所属自然日为准。
- **2026-04-24 增补（AI 产物双时间戳 + 新鲜度）**：新增 FR-054 / FR-055 要求
  所有 AI 卡片 / 弹窗同时展示 `generated_at`（AI 更新时间）与 `source_data_at`
  （参考数据时间），并在超出每类产物新鲜度阈值时显示过期标识。扩展 `FR-052`
  双时间戳存储、`FR-053` 回退期间时间戳保留、`AIArtifact` 实体新增两个
  时间戳字段、新增 `SC-060~SC-062`；Assumptions 新增"关于 AI 产物的新鲜度
  阈值"小节以表格形式给出每类默认阈值（午评 / 晚评 / 未来预测 24h、新闻
  总结 6h、个股介绍 30 天、个股分析 1 交易日）；Edge Cases 新增"过期标识
  视觉语义"与"回退期间时间戳保留"两条。US5 的 Acceptance Scenarios 同步
  更新（AS1/2/3/4/5 细化，新增 AS6 过期标识场景）；US6 / US7 / US8 未单独
  改写，通用规则由 FR-054 / FR-055 统一覆盖。
