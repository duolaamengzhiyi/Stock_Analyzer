# Quickstart — Stock Analyzer Platform 初学者完整部署指引

**Feature**: 001-initialization
**Date**: 2026-04-22
**阅读者**: 本仓库维护者 / 首次部署者（假定对 Vercel / Supabase / Sealos
三个平台都 **不熟悉**）。
**目标**: 跟着本文一步步做下去，就能得到一个可访问的线上站点。

---

## 路线总览

本项目部署分 7 个阶段：

```text
  [1] 申请 3 把 API Key / 账号
  [2] 本地开发环境 bootstrap（安装 Node / pnpm / Python）
  [3] Vercel 创建项目（连接 GitHub 仓库）
  [4] Vercel ↔ Supabase Integration（一键创建数据库）
  [5] 本地连接 Supabase + 跑 Drizzle migration（建表 + RLS）
  [6] Sealos 部署 AKTools + Python Scheduler
  [7] 首次历史回填 + 跑通全链路 + 上线
```

每一阶段完成后，本文给出"检查清单"让你确认状态。

---

## [1] 申请 3 把 API Key / 账号（约 30 min）

你需要以下账号（都免费，小项目无需付费）：

### 1.1 GitHub 账号

用途：托管代码。如果你是用这个仓库在 Cursor 中开发，GitHub 账号应该已经有了。

检查：本仓库 `git remote -v` 能看到 origin 指向你的 GitHub 即可。

### 1.2 Vercel 账号（免费 Hobby Plan）

**访问**：<https://vercel.com/signup>
**建议**：用 GitHub 账号登录（Sign up with GitHub），这样后续导入仓库零配置。

### 1.3 Supabase 账号（免费层）

**重要**：**不要** 直接在 Supabase 官网创建项目。本项目要走 **Vercel ↔ Supabase
Integration**（第 4 步），在 Vercel 里创建 Supabase 项目更方便（环境变量会
自动注入）。

访问 <https://supabase.com> 注册账号即可（同样推荐用 GitHub 登录）。

### 1.4 Sealos 账号

**访问**：<https://cloud.sealos.io>（国际版）或 <https://sealos.run>（中国镜像）
**登录方式**：微信 / 邮箱 / GitHub 均可。
**首次注册**：会进入一个控制台，有 App Launchpad / Terminal / Database
等 App。本项目只用 **App Launchpad**。

### 1.5 DeepSeek API Key

**访问**：<https://platform.deepseek.com>
**注册**：支持邮箱 / 手机号注册。
**创建 Key**：登录后 → API Keys → 新建 → 复制得到形如
`sk-xxxxxxxxx...` 的字符串。**立即保存在安全地方**，页面关闭后再也不会
完整显示。

> DeepSeek 按 token 计费，MVP 阶段（每日几次午评 / 晚评 / 预测）成本通常
> 很低。首次注册可能有少量免费额度；用完后按平台定价充值即可。
>
> **模型名**：实现阶段默认用 `deepseek-v4-flash`（官方文档标注 **1M** 上下文）。
> 旧名 `deepseek-chat` 仍可用但将于 2026-07-24 弃用，见
> [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)。

### ✅ 阶段 [1] 检查清单

- [ ] GitHub 账号 OK，本仓库能 `git push`
- [ ] Vercel 账号已注册（建议 GitHub 登录）
- [ ] Supabase 账号已注册（**尚未** 创建项目）
- [ ] Sealos 账号已登录控制台
- [ ] DeepSeek API Key 已创建并安全保存（形如 `sk-...`）

---

## [2] 本地开发环境 bootstrap（约 15 min）

### 2.1 Node.js + pnpm

本项目要求 Node 20 LTS 以上。检查：

```bash
node --version   # 期望 >= v20
pnpm --version   # 若显示 "command not found"：npm install -g pnpm
```

### 2.2 Python 3.12

仅用于本地测试 Scheduler（你也可以跳过，直接在 Sealos 上跑）。

```bash
python3 --version  # 期望 >= 3.12
```

如果你暂时不想装 Python，完全 OK——Scheduler 会打包进 Docker 镜像，
Sealos 上直接拉取运行。本文档的 Scheduler 本地调试部分可以跳过。

### 2.3 Supabase CLI（用于本地跑 migration 与起本地 Postgres 跑测试）

```bash
brew install supabase/tap/supabase    # macOS
# 或 scoop install supabase           # Windows (scoop)
# 或 npm install -g supabase           # 跨平台备选
```

### ✅ 阶段 [2] 检查清单

- [ ] `node --version` ≥ v20
- [ ] `pnpm --version` 有输出
- [ ] `supabase --version` 有输出
- [ ] Python（可选）≥ 3.12

---

## [3] Vercel 创建项目（连接 GitHub 仓库）（约 5 min）

> **注意**：此时 **仓库代码还只是 spec + 宪法**，Next.js 骨架还没写。你可以
> 选择：
>
> - **方案 A（推荐）**：先完成阶段 [3]-[4] 把账号体系和 Supabase 链接建好，
>   留着空 Vercel 项目；然后回到实现阶段（`/speckit-tasks` 与 `/speckit-implement`）
>   写代码，写的过程 git push 自动触发 Vercel 部署。
> - **方案 B**：等代码完全实现后再跑 [3] 及以后。
>
> 本文假定你选 **方案 A**。

### 3.1 从 Vercel Dashboard 导入仓库

1. 登录 Vercel → Dashboard → "Add New…" → "Project"
2. 选择 "Import Git Repository"，找到 `stock-analyzer-final` 仓库
3. 首次 import 会要求你授权 Vercel 访问 GitHub 的 repo
4. **Framework Preset**：Vercel 会自动识别（如果已有 `package.json` + Next.js）。
   若没有，手动选 "Next.js"
5. **Root Directory**：保持默认 `./`
6. **Build & Output Settings**：保持默认
7. **Environment Variables**：暂时留空（下一步会通过 Integration 自动注入）
8. 点击 "Deploy"

> 第一次 Deploy 可能会 **失败**（因为代码还没有，或者框架检测到是空仓库），
> 这是正常的。我们先把项目"壳"建好。

### 3.2 记住 Vercel 项目 URL

创建完成后你会看到：

- 生产域名：`https://stock-analyzer-final-<your-username>.vercel.app`
- 预览域名：每次 git push 生成一条

### ✅ 阶段 [3] 检查清单

- [ ] Vercel Dashboard 里能看到 `stock-analyzer-final` 项目
- [ ] 项目 Settings → Git 里显示了 `main` 分支与 GitHub 仓库名
- [ ] 生产域名 URL 记下

---

## [4] Vercel ↔ Supabase Integration（一键创建数据库）（约 10 min）

### 4.1 安装 Integration

1. 打开你刚创建的 Vercel 项目 → 顶部 tabs 选 **Integrations**
   （或 Settings → Integrations，视 Vercel 版本而定）
2. 点击 **Browse Marketplace**
3. 搜索 "Supabase" → 点击进入 → 点击 **Add Integration**
4. 选择你的 Vercel 账号 / 团队
5. 选择要链接的项目：勾选 `stock-analyzer-final`
6. 点击 **Continue**

### 4.2 从 Integration 流程里创建新 Supabase 项目

1. Integration 页面给出"Connect to existing project"和"Create new project"两个选项
2. 选 **Create new project**
3. 如果你之前还没 Supabase 账号，这里会要求授权
4. 填写：
   - **Project name**：`stock-analyzer-final-db`（或其它你喜欢的）
   - **Region**：**Singapore** 或 **Tokyo**（距离中国近，延迟低）
   - **Database password**：自动生成的强密码，**Vercel 会自动处理**，
     你无需手写；但建议 Integration 完成后去 Supabase Dashboard 存一份
5. 点击 **Create**

> 创建约需 1-2 分钟。结束后 Vercel 会把以下环境变量自动注入到你的
> Vercel 项目：
>
> ```text
> POSTGRES_URL               # 池化连接字符串（用于 Vercel Serverless）
> POSTGRES_URL_NON_POOLING   # 非池化连接（用于 Drizzle migration 与 Edge）
> POSTGRES_USER
> POSTGRES_PASSWORD
> POSTGRES_HOST
> POSTGRES_PRISMA_URL
> SUPABASE_URL
> SUPABASE_ANON_KEY
> SUPABASE_SERVICE_ROLE_KEY  # ⚠ 保密
> SUPABASE_JWT_SECRET
> ```
>
> 此外 Vercel 也会自动把前缀 `NEXT_PUBLIC_` 版本注入：
>
> ```text
> NEXT_PUBLIC_SUPABASE_URL
> NEXT_PUBLIC_SUPABASE_ANON_KEY
> ```

### 4.3 打开 Supabase Dashboard 验证

1. Integration 完成后，Vercel 页面会给出一个 "Open Supabase" 按钮
2. 点进去你会看到 Supabase 项目 dashboard
3. 左侧 **Table Editor** → 可以看到还没有 public 表（`auth.*` 会有 Supabase
   自带的认证表）

### 4.4 开启 Email confirm 并配置回跳 URL（重要！）

本项目使用真实邮箱注册登录，因此应该保留 Supabase 的邮箱确认能力。用户注册后会
收到确认邮件，点击邮件中的链接后回到站点并建立登录会话。

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL** 填你的线上站点地址，例如
   `https://stock-analyzer-final-<your-username>.vercel.app`
3. **Redirect URLs** 至少加入：
   - `http://localhost:3000/auth/callback`
   - `https://stock-analyzer-final-<your-username>.vercel.app/auth/callback`
4. Supabase Dashboard → **Authentication** → **Providers**
5. 找到 **Email**
6. **Confirm email** 开关 → **打开**
7. **Secure email change** 建议保持打开
8. Save

> 如果后续绑定了自定义域名，也要把
> `https://your-domain.com/auth/callback` 加入 Redirect URLs。

### ✅ 阶段 [4] 检查清单

- [ ] Vercel 项目 Settings → Environment Variables 里有一堆 `SUPABASE_*` 和
      `POSTGRES_*` 变量
- [ ] Supabase Dashboard 能打开对应项目
- [ ] Supabase Auth → URL Configuration 的 Site URL / Redirect URLs 已配置
- [ ] Supabase Auth → Providers → Email → Confirm email 已开启

---

## [5] 本地连接 Supabase + 跑 Drizzle migration（约 10 min）

此步骤需要把数据库表（见 `data-model.md`）真正创建到 Supabase。

### 5.1 把 Vercel 上的环境变量拉到本地

```bash
# 登录 Vercel CLI（首次）
pnpm add -g vercel
vercel login

# 在仓库根目录链接到 Vercel 项目
vercel link

# 拉取环境变量到本地
vercel env pull .env.local
```

完成后你的仓库根会有 `.env.local`，含所有 SUPABASE / POSTGRES 变量。
**⚠️** `.env.local` 已在 `.gitignore`，不会被提交；**千万不要** 把它提交
到公开仓库。

### 5.2 执行 Drizzle migration

> 这一步要在 **实现阶段** 代码写出来以后才能跑。当前阶段你仍然可以
> **预览**`pnpm db:migrate`（等价于 `drizzle-kit migrate`）会做什么，
> 但真正执行要到 `/speckit-implement` 实施 T0xx 任务之后。

实施阶段后实际命令（等代码落地后会自动生成对应 npm script）：

```bash
pnpm db:generate   # 从 lib/db/schema/*.ts 生成 migration SQL
pnpm db:migrate    # 应用 migration 到 Supabase
```

### 5.3 种子数据：插入邀请码

一次性运行 seed 脚本（实现阶段会提供 `pnpm db:seed` 或 SQL snippet）：

```sql
INSERT INTO public.invite_codes (code, reusable, description)
VALUES ('violet-everGarden', true, 'Primary invite code for initial phase');
```

**也可以** 直接在 Supabase Dashboard → SQL Editor 中粘贴执行。

### ✅ 阶段 [5] 检查清单（代码落地后才能打勾）

- [ ] `.env.local` 已拉取，内容非空
- [ ] `pnpm db:migrate` 无错误执行
- [ ] Supabase Dashboard → Table Editor 能看到 `profiles` / `stocks` /
      `stock_daily` 等业务表
- [ ] `invite_codes` 表里有 `violet-everGarden` 一行

---

## [6] Sealos 部署 AKTools + Python Scheduler（约 40 min）

### 6.1 创建 Namespace 并熟悉 App Launchpad

1. Sealos 控制台 → 左侧选择一个 Namespace（默认的 `default` 就行，
   或新建 `stock-analyzer`）
2. 打开 **App Launchpad**

### 6.2 部署 AKTools（公开镜像，最简单）

1. App Launchpad → **New Application**
2. 填写：
   - **Application Name**：`aktools`
   - **Image Name**：`akfamily/aktools:latest`
   - **CPU / Memory**：0.25 Core / 256 MiB（够用）
   - **Replicas**：1
   - **Access Configuration** → Container Port：`8080`
   - **Public Access**：**关闭**（AKTools 仅 Sealos 内部访问；若你需要从
     Vercel 直接调用部分接口，可以打开"Public Access"并勾选 HTTPS，得到
     一个 `https://aktools-xxx.sealoshzh.site` 的公网地址）
3. **Deploy**

> **决策**：本项目 Vercel 侧 `/api/search/stocks` 需要搜索股票代码/名称。
> 推荐策略：先把 AKTools 的 public access 打开，**得到公网 URL**，把 URL
> 填入 `AKTOOLS_BASE_URL`；Scheduler 在 Sealos 内部调用时用内网地址，
> Vercel 搜索接口必要时用公网地址做兜底（本项目实现会优先查 Supabase 里
> 已有的 `stocks` 表，AKTools 只是备用）。

### 6.3 构建 Python Scheduler 镜像

现在你需要把 `sealos/scheduler/` 目录打包成 Docker 镜像。有两种办法：

**选项 A（推荐）**：Sealos **DevBox** 在线构建

1. Sealos 左侧 **DevBox** → **New DevBox**
2. 选 "Python" 模板 → 启动
3. 在 DevBox terminal 里 `git clone` 你的仓库
4. `cd sealos/scheduler`
5. 运行 `docker build -t stock-scheduler:v1 .`（DevBox 内已有 docker）
6. Sealos 控制台 → **Container Registry** → Push 镜像到 Sealos 自带 registry
   （`<namespace>.sealos.io/stock-scheduler:v1`）

**选项 B**：本地 build 推到 Docker Hub

1. 确保本地有 Docker Desktop
2. `docker build -t <your-dockerhub-username>/stock-scheduler:v1 sealos/scheduler`
3. `docker push <your-dockerhub-username>/stock-scheduler:v1`

### 6.4 部署 Scheduler 到 Sealos App Launchpad

1. **New Application**
2. 填写：
   - **Application Name**：`scheduler`
   - **Image Name**：第 6.3 步推到的镜像
   - **CPU / Memory**：0.25 Core / 512 MiB
   - **Replicas**：1（**永远只运行一份**，避免 cron 重复触发）
   - **Access Configuration**：Container Port `8000`；**Public Access: On**
     + HTTPS（用于 `/trigger/*` 手动触发端点）
   - **Environment Variables**（一次性填入全部，见 research.md R18 Sealos 清单）：

     ```text
     SUPABASE_URL=<从 Vercel 或 Supabase Dashboard 复制>
     SUPABASE_SERVICE_ROLE_KEY=<同上>
     AKTOOLS_BASE_URL=http://aktools.ns-<your-ns>.svc.cluster.local:8080
     DEEPSEEK_API_KEY=sk-xxxxxxxx（阶段 1.5 拿到的）
     DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
     DEEPSEEK_MODEL_MIDDAY=deepseek-v4-flash
     DEEPSEEK_MODEL_EVENING=deepseek-v4-flash
     DEEPSEEK_MODEL_FORECAST=deepseek-v4-flash
     DEEPSEEK_MODEL_NEWS_SUMMARY=deepseek-v4-flash
     SCHEDULER_AUTH_TOKEN=<自己想一个长随机字符串，至少 32 字>
     TZ=Asia/Shanghai
     ```

     > **关于 `AKTOOLS_BASE_URL` 的内网 DNS**：Sealos 的 service DNS 形如
     > `<app-name>.<namespace>.svc.cluster.local:<port>`。你在 App Launchpad
     > 里创建 `aktools` 后，点进 Detail 页面能看到"Internal Address"，
     > 直接复制即可。

3. **Deploy**
4. 部署完成后 `scheduler` App 会给一个 HTTPS 域名，形如
   `https://scheduler-xxx.sealoshzh.site`。记住它，后续首次回填会用到。

### ✅ 阶段 [6] 检查清单

- [ ] `aktools` App 状态 "Running"，`GET <aktools-url>/api/public/stock_zh_a_spot_em`
      能返回 JSON
- [ ] `scheduler` App 状态 "Running"，`GET <scheduler-url>/health` 返回 200
- [ ] 所有 Scheduler 环境变量填齐
- [ ] `scheduler` 日志里能看到 `APScheduler started, next run at ...`

---

## [7] 首次历史回填 + 跑通全链路 + 上线（约 30 min）

### 7.1 首次历史回填（FR-024）

```bash
curl -X POST "https://<scheduler-url>/trigger/initial-backfill" \
     -H "X-Scheduler-Token: <你设置的 SCHEDULER_AUTH_TOKEN>"
```

这会触发 Scheduler 拉 60 天历史。预期耗时 **3-10 分钟**（取决于 AKTools
实例性能）。你可以在 Scheduler 日志里观察进度，或在 Supabase Dashboard
→ Table Editor → `stock_daily` 里刷新看到行数递增。

完成后检查：

```sql
SELECT COUNT(*) FROM public.stock_daily;
-- 期望约 330,000
SELECT COUNT(DISTINCT trade_date) FROM public.stock_daily;
-- 期望约 60
```

### 7.2 手动跑一次 `stock-daily-close`（验证通路）

```bash
curl -X POST "https://<scheduler-url>/trigger/stock-daily-close" \
     -H "X-Scheduler-Token: <token>"
```

完成后检查 `stock_screen_results` 表有 ≤ 40 行（launching-soon + main-uptrend
各 ≤ 20）。

### 7.3 手动跑一次 `calendar-refresh`

```bash
curl -X POST "https://<scheduler-url>/trigger/calendar-refresh" \
     -H "X-Scheduler-Token: <token>"
```

完成后 `market_calendar` 表应有 5 个 market × ~180 rows 的数据。

### 7.4 把所有环境变量补齐到 Vercel

现在 Vercel 项目还缺这些（前面 Supabase Integration 没覆盖的）：

1. Vercel Dashboard → 项目 → **Settings** → **Environment Variables**
2. 新增：
   - `DEEPSEEK_API_KEY` = `sk-xxxxxxxx`
   - `DEEPSEEK_BASE_URL` = `https://api.deepseek.com/v1`
   - `DEEPSEEK_MODEL_STOCK_INTRO` = `deepseek-v4-flash`
   - `DEEPSEEK_MODEL_STOCK_ANALYSIS` = `deepseek-v4-flash`
   - `AKTOOLS_BASE_URL` = `https://aktools-xxx.sealoshzh.site`（AKTools 公网地址）
   - `INVITE_CODE` = `violet-everGarden`
3. Production / Preview / Development 三个环境都勾上
4. 点 **Save**
5. 项目 → **Deployments** → 最新一条 → "…"菜单 → **Redeploy** 让新变量生效

### 7.5 访问你的线上站点

```text
https://stock-analyzer-final-<your-username>.vercel.app
```

打开后应该看到：
- 首页（动态背景 + 登录注册入口）
- 点注册 → 邀请码填 `violet-everGarden` + 真实邮箱 + 账号名 + 密码
- 注册成功 → 提示查收确认邮件
- 点击邮件确认链接 → 回到站点并进入 Dashboard（或回到登录弹窗后用邮箱登录）
- Dashboard 上所有板块显示数据（此时历史回填已完成）

### ✅ 阶段 [7] 检查清单

- [ ] `initial-backfill` 触发成功且 `stock_daily` 行数 ≈ 330,000
- [ ] 手动触发 `stock-daily-close` 能生成 `stock_screen_results`
- [ ] `market_calendar` 表有 5 市场数据
- [ ] Vercel 环境变量补齐并 Redeploy
- [ ] 线上站点可访问，注册、邮箱确认、登录流程完整

---

## 排错常见问题

### Q1. AKTools 访问报超时

**排查**：
1. 先 Sealos 控制台看 `aktools` App 状态是否 Running
2. 看日志里是否有 `INFO: Uvicorn running on http://0.0.0.0:8080`
3. Scheduler 调 AKTools 用的是内网 DNS，检查 `AKTOOLS_BASE_URL` 是否正确
4. 偶发的上游东方财富限流——Scheduler 自带 3 次重试；看 audit_logs 的
   `error_detail` 字段

### Q2. Drizzle migration 报 `permission denied`

**排查**：你的 `.env.local` 可能用了 `POSTGRES_URL`（池化），migration 必须
用 `POSTGRES_URL_NON_POOLING`。

### Q3. Vercel deploy 后注册报 "无法连接数据库"

**排查**：
1. Vercel → Functions → Logs 看具体堆栈
2. 确认 `SUPABASE_SERVICE_ROLE_KEY` 已填
3. 确认 `POSTGRES_URL_NON_POOLING` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` 等环境变量已同步
4. 确认 Drizzle migration 已在目标 Supabase 项目执行

### Q4. 注册成功但没收到确认邮件

**排查**：
1. Supabase → Authentication → Logs 查看是否有邮件发送或 rate limit 错误
2. 检查垃圾邮件箱
3. 确认 Supabase → Authentication → URL Configuration 中的 Site URL 和
   Redirect URLs 包含当前站点域名与 `/auth/callback`
4. 如果面向真实用户上线，建议在 Supabase 配置自定义 SMTP，避免默认邮件额度或
   发件人信誉影响送达

### Q5. DeepSeek 调用 429 太多请求

**排查**：DeepSeek API 有并发 / 速率限制（`deepseek-v4-flash` 默认 2500 并发）。
解决：
- 确认 Scheduler 的 APScheduler job 不会并发执行（`max_instances=1`）
- 若仍触发限流，在 job 间加短延迟或错峰 cron

### Q6. Realtime 在前端不触发

**排查**：
1. 浏览器 DevTools → Network 看 WebSocket 连接是否建立（URL 含 `/realtime`）
2. Scheduler 侧是否真的 `channel.send()`了（看 log）
3. Supabase Dashboard → Realtime 看 channel `data-updated` 的 subscribers 数

---

## 日常运维

### 查看抓取状态

Supabase SQL Editor：

```sql
SELECT kind, status, COUNT(*), MAX(occurred_at)
FROM audit_logs
WHERE occurred_at > now() - INTERVAL '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 手动触发任一 job

```bash
curl -X POST "https://<scheduler-url>/trigger/<job-id>" \
     -H "X-Scheduler-Token: <token>"
```

`<job-id>` 参考 `contracts/sealos-jobs.md` 最下方枚举。

### 查看 Scheduler 下次运行时间

```bash
curl "https://<scheduler-url>/jobs" -H "X-Scheduler-Token: <token>"
```

### 紧急暂停所有定时任务

Sealos 控制台 → `scheduler` App → 点 Pause。恢复时点 Resume。

---

## [8] User Story 验收记录

### [8.1] US1 邀请码注册登录闭环 — sm / lg 断点验收（T073b · 2026-06-10）

**前置**：本机 `pnpm dev`（端口 3010）；Supabase 已迁移；浏览器 chrome-devtools-mcp。

| 场景 | 断点 | 截图 | 通过项 |
|---|---|---|---|
| 首页 hero（未登录） | lg 1280×800 | `docs/screenshots/us1-home-lg.png` | 渐变背景 + Stock Analyzer 标题 + "登录 / 注册" 按钮 + 免责声明，无溢出无水平滚动 |
| 首页 hero（未登录） | sm 375×800 | `docs/screenshots/us1-home-sm.png` | 标题自适应 `text-4xl/5xl` 切换；按钮 size=lg 仍居中；纵向无截断 |
| AuthModal 登录态 | lg | `docs/screenshots/us1-modal-login-lg.png` | MagicCard 半透明 + 登录/注册 Tab + 邮箱/密码字段 + "7 天内免登录" 复选 + Close 按钮 |
| AuthModal 注册态 | lg | `docs/screenshots/us1-modal-register-lg.png` | 邀请码字段额外出现 + helper 文本 `本期邀请码：violet-everGarden（开发期可见，生产隐藏）`；账号名字段独立分行 |
| AuthModal 注册态 | sm | `docs/screenshots/us1-modal-register-sm.png` | 弹窗 `sm:max-w-md` 自适应；字段单列；Close 按钮可触达 |
| 未登录访问 `/dashboard` | sm | `docs/screenshots/us1-redirect-sm.png` | 自动 302 到 `/?redirect=%2Fdashboard&login=1`，Modal 自动展开（FR-005） |
| 未登录访问 `/dashboard` | lg | `docs/screenshots/us1-redirect-lg.png` | 同上 |

**控制台**：DevTools console 在两个断点全程 0 error / 0 warning。

**a11y/触达性**：
- 所有 input 关联了 `<Label for>`，键盘 Tab 可走完表单
- 错误文案使用 `role=alert`、注册成功提示使用 `role=status`，屏读器可获取
- ChangePercent 组件已用 `▲ ▼` + 颜色双编码（FR-055，US3 启用时再实测）

**已知差异点 / 跟进项**：
- 当前首页 hero 还是静态渐变背景；US9（Phase 12）会替换为 ≥3 组动态背景
- AuthModal 关闭按钮的图标尺寸在 `radix Dialog` 默认下偏小，记入 polish 候选
- 没有走完整的"注册 → 邮箱确认 → 登录"端到端实测（需要真实可收的邮箱 + DeepSeek/Aktools 暂未连接）；该路径在 [7.5] 阶段联调时复测

---

## 总耗时估算

- 熟手走通：**90 分钟**
- 首次接触：**3-4 小时**（含账号注册 + 理解过程）

---

## 下一步

完成以上所有阶段后，回到 Spec Kit 流程执行 `/speckit-tasks` 生成细粒度
开发任务，然后 `/speckit-implement` 开始写代码。实现过程中 git push 会
自动触发 Vercel 部署，你只需要偶尔看一眼 Scheduler 日志 + Supabase 里的
行数，本站就会自行跑起来。
