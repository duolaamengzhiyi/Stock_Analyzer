"""DeepSeek 客户端：基于 openai SDK 指向 DeepSeek 兼容端点。

与 lib/deepseek/client.ts 保持口径一致（plan.md "Constraints"）。
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from openai import OpenAI

from sealos.scheduler.config import get_settings


@lru_cache(maxsize=1)
def get_deepseek_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )


@dataclass(slots=True)
class DeepSeekChatResult:
    content: str
    tokens_in: int | None
    tokens_out: int | None
    model: str


def deepseek_chat(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
    max_tokens: int | None = None,
) -> DeepSeekChatResult:
    """同步 chat completion。失败抛异常由 jobs 层捕获。"""
    client = get_deepseek_client()
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    choice = completion.choices[0]
    return DeepSeekChatResult(
        content=choice.message.content or "",
        tokens_in=completion.usage.prompt_tokens if completion.usage else None,
        tokens_out=completion.usage.completion_tokens if completion.usage else None,
        model=model,
    )
