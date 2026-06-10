/**
 * DeepSeek 兼容 OpenAI SDK 客户端（Vercel 侧）。
 *
 * 与 sealos/scheduler/clients/deepseek.py 保持口径一致（plan.md "Constraints"）。
 * 默认模型 `deepseek-v4-pro`；按需可由 env 覆盖。
 *
 * 提供：
 *   - 同步 chat completion
 *   - 流式 SSE 包装（可直接 pipeThrough 给 Route Handler 的 ReadableStream）
 */
import OpenAI from "openai";

import "server-only";

export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro" as const;

let _client: OpenAI | null = null;

export function deepseekClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL =
    process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export interface DeepSeekChatOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/** 同步生成（用于服务端预生成、缓存读取等场景） */
export async function deepseekChat(opts: DeepSeekChatOptions): Promise<{
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  model: string;
}> {
  const client = deepseekClient();
  const model = opts.model ?? DEFAULT_DEEPSEEK_MODEL;
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens,
  });
  const choice = completion.choices[0];
  return {
    content: choice?.message?.content ?? "",
    tokensIn: completion.usage?.prompt_tokens ?? null,
    tokensOut: completion.usage?.completion_tokens ?? null,
    model,
  };
}

/**
 * 流式生成（SSE）：返回 ReadableStream<string>。
 * 调用方负责把 chunks 编码成 SSE 帧（`data: ...\n\n`）写回 response。
 */
export async function deepseekChatStream(
  opts: DeepSeekChatOptions,
): Promise<ReadableStream<string>> {
  const client = deepseekClient();
  const model = opts.model ?? DEFAULT_DEEPSEEK_MODEL;
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens,
    stream: true,
  });

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(delta);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
