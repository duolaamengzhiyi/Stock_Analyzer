"use client";

/**
 * AuthModal（FR-001 / FR-002 / FR-007 / FR-009）。
 * - MagicCard 半透明弹窗
 * - Tab 切换"注册 / 登录"
 * - 行内错误提示（FR-007 统一文案；注册 FR-009 邮箱确认提示）
 * - URL 携带 ?login=1 时自动打开
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagicCard } from "@/components/magic/MagicCard";
import { useAuth } from "@/hooks/useAuth";
import { INVITE_CODE } from "@/lib/utils/zod-schemas";

type Tab = "login" | "register";

export function AuthModalLauncher() {
  const params = useSearchParams();
  const initiallyOpen = params.get("login") === "1";
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    if (params.get("login") === "1") setOpen(true);
  }, [params]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">登录 / 注册</Button>
      </DialogTrigger>
      <DialogContent
        className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-md"
      >
        <MagicCard className="rounded-2xl p-0">
          <div className="rounded-2xl bg-background/80 p-6 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-xl">欢迎使用 Stock Analyzer</DialogTitle>
              <DialogDescription>
                邀请制注册；填写正确邀请码即可创建账号。
              </DialogDescription>
            </DialogHeader>
            <AuthForm onSuccess={() => setOpen(false)} />
          </div>
        </MagicCard>
      </DialogContent>
    </Dialog>
  );
}

function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState<Tab>("login");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const { register, login, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfo(null);
    setSubmitting(true);
    try {
      if (tab === "register") {
        const result = await register({
          inviteCode,
          email,
          username,
          password,
        });
        if (result.ok) {
          setInfo("注册成功，请前往邮箱完成确认后再登录。");
        }
      } else {
        const result = await login({ email, password, rememberMe });
        if (result.ok) {
          onSuccess();
          const redirect = params.get("redirect") ?? "/dashboard";
          router.push(redirect);
          router.refresh();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["login", "register"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => {
              setTab(t);
              setInfo(null);
            }}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              tab === t ? "bg-background shadow" : "text-muted-foreground"
            }`}
          >
            {t === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {tab === "register" && (
          <Field
            id="invite"
            label="邀请码"
            value={inviteCode}
            onChange={setInviteCode}
            placeholder="请输入邀请码"
            autoComplete="off"
            helper={`本期邀请码：${INVITE_CODE}（开发期可见，生产隐藏）`}
            required
          />
        )}
        <Field
          id="email"
          type="email"
          label="邮箱"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {tab === "register" && (
          <Field
            id="username"
            label="账号名"
            value={username}
            onChange={setUsername}
            placeholder="3–20 位字母 / 数字 / _ / -"
            autoComplete="username"
            required
          />
        )}
        <Field
          id="password"
          type="password"
          label="密码"
          value={password}
          onChange={setPassword}
          placeholder="≥ 8 位"
          autoComplete={tab === "login" ? "current-password" : "new-password"}
          required
        />

        {tab === "login" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            7 天内免登录
          </label>
        )}

        {authError && (
          <p role="alert" className="text-sm text-destructive">
            {authError}
          </p>
        )}
        {info && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            {info}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "处理中…" : tab === "login" ? "登录" : "创建账号"}
        </Button>
      </form>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  helper?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
  helper,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
