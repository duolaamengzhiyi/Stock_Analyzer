/**
 * Vercel 侧 DeepSeek prompt 模板（FR-051 个股 AI 介绍 / 个股 AI 分析）。
 *
 * 与 sealos/scheduler/prompts.py 的 stock-intro / stock-analysis 模板保持
 * 字面口径一致（同一文案库），便于 US7 弹窗直读 ai_artifacts 缓存命中。
 */

export interface StockIntroContext {
  code: string;
  name: string;
  market: string;
  industry?: string | null;
  concepts?: string[] | null;
  marketCapBillion?: number | null;
}

export interface StockAnalysisContext extends StockIntroContext {
  /** 最近 N 个交易日的概要（前端不直接暴露原始 OHLC，由调用方先压缩） */
  recentDailyMarkdown: string;
  /** 当日午评 / 晚评摘要（如有） */
  middayDigest?: string | null;
  eveningDigest?: string | null;
}

export const STOCK_INTRO_SYSTEM = `你是一位专业、克制的中文股票编辑。
任务：用中性、不带推荐意味的语气向散户读者介绍一只 A 股股票。
要求：
- 不推荐买卖、不预测股价。
- 200–400 字，三个段落：1) 公司业务定位，2) 所属概念板块/行业逻辑，3) 风险与中性提示。
- 文末附"以上信息仅供参考，不构成投资建议"一行。`;

export const STOCK_ANALYSIS_SYSTEM = `你是一位专业、克制的中文股票分析编辑。
任务：基于给定的最近行情摘要 + 当日 AI 点评，输出结构化分析。
要求：
- 不推荐买卖、不预测股价。
- 必须严格分三段：「走势」「量价」「风险」，每段独立标题。
- 总长 300–600 字。
- 文末附"以上信息仅供参考，不构成投资建议"一行。`;

export function buildStockIntroUser(ctx: StockIntroContext): string {
  const lines = [
    `股票代码：${ctx.code}`,
    `股票名称：${ctx.name}`,
    `所属市场：${ctx.market}`,
  ];
  if (ctx.industry) lines.push(`申万一级行业：${ctx.industry}`);
  if (ctx.concepts?.length)
    lines.push(`命中概念板块：${ctx.concepts.join("、")}`);
  if (ctx.marketCapBillion != null)
    lines.push(`总市值：${ctx.marketCapBillion.toFixed(1)} 亿元`);
  lines.push("", "请按系统提示规范完成介绍。");
  return lines.join("\n");
}

export function buildStockAnalysisUser(ctx: StockAnalysisContext): string {
  const intro = buildStockIntroUser(ctx);
  const sections = [intro, "", "[最近行情摘要]", ctx.recentDailyMarkdown];
  if (ctx.middayDigest) {
    sections.push("", "[当日午评摘要]", ctx.middayDigest);
  }
  if (ctx.eveningDigest) {
    sections.push("", "[当日晚评摘要]", ctx.eveningDigest);
  }
  sections.push("", "请按系统提示规范完成分析。");
  return sections.join("\n");
}
