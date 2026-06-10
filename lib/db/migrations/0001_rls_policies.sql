-- ====================================================================
-- 0001_rls_policies.sql · 手写 RLS 策略
-- 参考 specs/001-initialization/data-model.md 各表 RLS 段。
-- 默认所有业务表启用 RLS；未授权角色视为「全拒绝」。
-- 写入面只允许 service_role（Vercel Route Handler / Sealos Scheduler 服务端）。
-- ====================================================================

-- ---------- 启用 RLS（即使无 policy 也意味着 anon/authenticated 全拒）----------
ALTER TABLE "profiles"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "long_lived_tokens"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invite_codes"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stocks"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_daily"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_screen_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watchlist_items"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "news_items"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_artifacts"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sector_picks"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "market_calendar"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           ENABLE ROW LEVEL SECURITY;

-- ---------- profiles：自己读自己、自己写自己 last_login_at ----------
CREATE POLICY "profiles_self_select" ON "profiles"
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_self_update" ON "profiles"
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- long_lived_tokens / invite_codes / audit_logs：全关 ----------
-- 不创建任何 policy；anon + authenticated 均无法访问。
-- service_role 自动绕过 RLS。

-- ---------- stocks / stock_daily / stock_screen_results：登录可读 ----------
CREATE POLICY "stocks_auth_select" ON "stocks"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_daily_auth_select" ON "stock_daily"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_screen_results_auth_select" ON "stock_screen_results"
  FOR SELECT TO authenticated USING (true);

-- ---------- watchlist_items：自己增删改查自己 ----------
CREATE POLICY "wi_self_all" ON "watchlist_items"
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- news_items / ai_artifacts / sector_picks / market_calendar：登录可读 ----------
CREATE POLICY "news_items_auth_select" ON "news_items"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_artifacts_auth_select" ON "ai_artifacts"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sector_picks_auth_select" ON "sector_picks"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "market_calendar_auth_select" ON "market_calendar"
  FOR SELECT TO authenticated USING (true);
