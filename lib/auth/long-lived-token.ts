/**
 * 7 天免登录长期凭证（FR-004 / FR-006）。
 *
 * - 客户端 cookie 仅持有 raw token（HttpOnly + Secure + SameSite=Lax）
 * - DB 仅存 SHA-256(raw)；DB 泄露也无法复原 raw token
 * - 登出 / 显式吊销 → revoked_at = now()
 */
import "server-only";

import { randomBytes, createHash } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { longLivedTokens } from "@/lib/db/schema";

export const LLT_COOKIE_NAME = "llt_token";
export const LLT_TTL_DAYS = 7;
export const LLT_TTL_SECONDS = LLT_TTL_DAYS * 24 * 60 * 60;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  // 32 字节 → 64 hex 位；超过常见 token 熵
  return randomBytes(32).toString("hex");
}

export interface IssueLongLivedTokenInput {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * 生成 raw token，写入 long_lived_tokens 表，返回 raw（仅此一次可见）。
 * 调用方负责把 raw 写入 cookie。
 */
export async function issueLongLivedToken(
  input: IssueLongLivedTokenInput,
): Promise<{ raw: string; expiresAt: Date }> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + LLT_TTL_SECONDS * 1000);

  await db.insert(longLivedTokens).values({
    userId: input.userId,
    tokenHash,
    expiresAt,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  });

  return { raw, expiresAt };
}

/**
 * 校验 raw token，命中且未吊销且未过期 → 返回 userId；否则 null。
 * 同时刷新 expires_at（滑动 7 天）以实现"7 天内任意活跃即续命"。
 */
export async function verifyAndSlideLongLivedToken(
  raw: string,
): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const now = new Date();
  const rows = await db
    .select({
      id: longLivedTokens.id,
      userId: longLivedTokens.userId,
    })
    .from(longLivedTokens)
    .where(
      and(
        eq(longLivedTokens.tokenHash, tokenHash),
        isNull(longLivedTokens.revokedAt),
        gt(longLivedTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const found = rows[0];

  // 滑动续期
  const nextExpiry = new Date(Date.now() + LLT_TTL_SECONDS * 1000);
  await db
    .update(longLivedTokens)
    .set({ expiresAt: nextExpiry })
    .where(eq(longLivedTokens.id, found.id));

  return found.userId;
}

/** 吊销当前 raw token 对应的 LLT（登出 FR-006）。 */
export async function revokeLongLivedTokenByRaw(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await db
    .update(longLivedTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(longLivedTokens.tokenHash, tokenHash),
        isNull(longLivedTokens.revokedAt),
      ),
    );
}

/** 吊销该用户全部仍有效的 LLT（用于安全场景，例如管理员强制下线）。 */
export async function revokeAllLongLivedTokensForUser(
  userId: string,
): Promise<void> {
  await db
    .update(longLivedTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(longLivedTokens.userId, userId),
        isNull(longLivedTokens.revokedAt),
      ),
    );
}
