/**
 * 跨端 Zod 校验模式（FR-002 / FR-003 / FR-008）。
 * Server / Client 共享，确保校验口径一致。
 */
import { z } from "zod";

/** 邀请码：本期硬编码，与 invite_codes 表种子一致（FR-002） */
export const INVITE_CODE = "violet-everGarden" as const;

export const inviteCodeSchema = z
  .string()
  .trim()
  .refine((v) => v === INVITE_CODE, {
    message: "邀请码错误",
  });

/** 邮箱：去空格 + 小写 + 标准邮箱校验 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "邮箱格式不正确" });

/** 密码：≥ 8 位（FR-003 由 Supabase Auth 散列存储；强度规则保持简洁） */
export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(64, "密码不超过 64 位");

/**
 * 账号名：^[A-Za-z0-9_-]{3,20}$（FR-008）。
 * 服务端写入前 toLowerCase；usernameDisplay 保留原写。
 */
export const usernameRegex = /^[A-Za-z0-9_-]{3,20}$/;
export const usernameSchema = z
  .string()
  .trim()
  .regex(usernameRegex, "账号名仅支持字母、数字、下划线、短横线，长度 3–20");

/** 股票代码：6 位数字（FR-010 搜索 + 自选） */
export const stockCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "股票代码必须是 6 位数字");

/** 注册表单 */
export const registerInputSchema = z.object({
  inviteCode: inviteCodeSchema,
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});

/** 登录表单 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional().default(false),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
