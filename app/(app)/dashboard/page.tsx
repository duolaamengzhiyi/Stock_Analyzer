/**
 * Dashboard 占位（US3 / US4 / US5 接入后会替换为 Bento Grid）。
 * 此处仅保证 (app) 路由组可访问，middleware + (app)/layout 拦截链路可被验证。
 */
export default function DashboardPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        启动在即 / 主升浪 / 自选股 / AI 点评 / 新闻 / 板块 在 Phase 5–13 内接入。
      </p>
    </main>
  );
}
