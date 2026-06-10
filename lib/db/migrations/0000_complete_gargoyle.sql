-- 注意：auth.users 由 Supabase 平台维护，这里不重复 DDL；
-- profiles.user_id 的外键引用通过下方 ALTER TABLE 添加。
CREATE TABLE "ai_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(24) NOT NULL,
	"primary_key" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_data_at" timestamp with time zone NOT NULL,
	"upstream_hash" varchar(64),
	"model" varchar(40),
	"tokens_in" integer,
	"tokens_out" integer,
	"failed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"subject" varchar(64),
	"meta" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_detail" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(20) NOT NULL,
	"username_display" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "long_lived_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"reusable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"code" varchar(6) PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"market" varchar(8) NOT NULL,
	"is_st" boolean DEFAULT false NOT NULL,
	"delisted" boolean DEFAULT false NOT NULL,
	"industry_l1" varchar(32),
	"concepts" text[],
	"latest_market_cap" numeric(20, 2),
	"latest_snapshot_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_daily" (
	"code" varchar(6) NOT NULL,
	"trade_date" date NOT NULL,
	"open" numeric(12, 4),
	"high" numeric(12, 4),
	"low" numeric(12, 4),
	"close" numeric(12, 4) NOT NULL,
	"volume" numeric(20, 0) NOT NULL,
	"turnover" numeric(20, 2),
	"change_pct" numeric(8, 4),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_daily_code_trade_date_pk" PRIMARY KEY("code","trade_date")
);
--> statement-breakpoint
CREATE TABLE "stock_screen_results" (
	"trade_date" date NOT NULL,
	"kind" varchar(24) NOT NULL,
	"code" varchar(6) NOT NULL,
	"rank" integer NOT NULL,
	"snapshot_change_pct" numeric(8, 4),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"debug_meta" jsonb,
	CONSTRAINT "stock_screen_results_trade_date_kind_code_pk" PRIMARY KEY("trade_date","kind","code")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(16) NOT NULL,
	"external_id" varchar(64),
	"title" text NOT NULL,
	"summary" text,
	"body" text NOT NULL,
	"url" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sector_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_date" date NOT NULL,
	"rank" integer NOT NULL,
	"concept_board_code" varchar(16) NOT NULL,
	"concept_board_name" varchar(32) NOT NULL,
	"leader_code" varchar(6),
	"leader_name" varchar(32),
	"rationale_short" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_calendar" (
	"market" varchar(8) NOT NULL,
	"date" date NOT NULL,
	"is_open" boolean NOT NULL,
	"memo" text,
	CONSTRAINT "market_calendar_market_date_pk" PRIMARY KEY("market","date")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "long_lived_tokens" ADD CONSTRAINT "long_lived_tokens_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_daily" ADD CONSTRAINT "stock_daily_code_stocks_code_fk" FOREIGN KEY ("code") REFERENCES "public"."stocks"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_screen_results" ADD CONSTRAINT "stock_screen_results_code_stocks_code_fk" FOREIGN KEY ("code") REFERENCES "public"."stocks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_code_stocks_code_fk" FOREIGN KEY ("code") REFERENCES "public"."stocks"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sector_picks" ADD CONSTRAINT "sector_picks_leader_code_stocks_code_fk" FOREIGN KEY ("leader_code") REFERENCES "public"."stocks"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_kind_key_idx" ON "ai_artifacts" USING btree ("kind","primary_key","generated_at" DESC);--> statement-breakpoint
CREATE INDEX "ai_kind_sourcedate_idx" ON "ai_artifacts" USING btree ("kind","source_data_at" DESC);--> statement-breakpoint
CREATE INDEX "al_kind_idx" ON "audit_logs" USING btree ("kind","occurred_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_idx" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "llt_user_idx" ON "long_lived_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "llt_hash_idx" ON "long_lived_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "llt_exp_idx" ON "long_lived_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stocks_market_idx" ON "stocks" USING btree ("market");--> statement-breakpoint
CREATE INDEX "stocks_name_idx" ON "stocks" USING btree ("name");--> statement-breakpoint
CREATE INDEX "stock_daily_date_idx" ON "stock_daily" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "stock_daily_date_code_idx" ON "stock_daily" USING btree ("trade_date","code");--> statement-breakpoint
CREATE INDEX "ssr_date_kind_idx" ON "stock_screen_results" USING btree ("trade_date","kind","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "wi_user_code_idx" ON "watchlist_items" USING btree ("user_id","code");--> statement-breakpoint
CREATE INDEX "wi_user_order_idx" ON "watchlist_items" USING btree ("user_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "ni_source_ext_idx" ON "news_items" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "ni_published_idx" ON "news_items" USING btree ("published_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "sp_date_rank_idx" ON "sector_picks" USING btree ("trade_date","rank");--> statement-breakpoint
CREATE INDEX "sp_date_idx" ON "sector_picks" USING btree ("trade_date" DESC);--> statement-breakpoint
CREATE INDEX "mc_date_idx" ON "market_calendar" USING btree ("date");