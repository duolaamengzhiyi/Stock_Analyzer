/**
 * 首页（公开）：放品牌 hero + 登录/注册触发按钮。
 * 动态背景在 US9（Phase 12）由 active-bg 注入；当前先用 static placeholder。
 *
 * 当 URL 含 ?login=1 或 ?redirect=... 时，会自动打开 AuthModal。
 */
import { Suspense } from "react";

import { AuthModalLauncher } from "@/app/(auth)/_modals/auth-modal";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container relative z-10 mx-auto flex flex-col items-center gap-8 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Stock Analyzer
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          A 股每日点评 · 启动在即与主升浪选股 · 自选股盯盘 · 资讯与 AI 总结
        </p>
        <Suspense fallback={<Button size="lg">登录 / 注册</Button>}>
          <AuthModalLauncher />
        </Suspense>
        <p className="text-xs text-muted-foreground">
          仅供研究与学习参考，不构成投资建议
        </p>
      </div>
    </main>
  );
}
