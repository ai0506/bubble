# CLAUDE.md

本文件指导 Claude Code 在本仓库中工作。

## 项目是什么

**asw的Bubble** —— 一个娱乐性的「竖屏聊天 / 订阅展示」MVP（`package.json` 名为 `bubble-mvp`）。

- 访客端（`/`）：在一个手机外壳里展示管理员发布的公开消息（文字 / 图片 / GIF / 语音 / 视频 / Motion Photo），并可在「订阅」后发送私信。
- 管理端（`/admin`）：管理员登录后发布公开消息、上传媒体、删除消息。
- **没有真实账号系统**：访客身份用 `visitor_id` + 昵称，存在浏览器 `localStorage`；订阅、剩余条数也只是前端 localStorage 状态，纯娱乐效果，用户可自行篡改。

## 技术栈

- **Next.js 15**（App Router）+ **React 19** + **TypeScript**
- **Tailwind CSS 3**
- **Supabase**：Postgres（`messages` 单表）+ private Storage bucket `chat-media`，服务端用 `@supabase/supabase-js` 以 service role key 访问
- `lucide-react` 图标
- 部署面向 Vercel

## 目录结构（关键部分）

- `app/page.tsx` — 访客聊天页（`ChatScreen`）
- `app/admin/page.tsx` — 管理面板（`AdminPanel`）
- `app/api/messages/route.ts` — 访客读取/发送消息
- `app/api/admin/messages/route.ts` — 管理员发文字消息 / 删除（硬删除：先删 Storage 文件再删行）
- `app/api/admin/upload/route.ts` — 管理员上传媒体（含 Motion Photo 拆分）
- `app/api/admin/login`、`logout` — 管理员会话登录/登出
- `app/api/media/file/route.ts`、`signed-url/route.ts` — 通过短期 signed URL 代理私有媒体
- `lib/supabaseAdmin.ts` — 服务端 Supabase client（service role）
- `lib/adminAuth.ts` — 基于 HMAC-SHA256 签名 cookie 的管理员会话
- `lib/visitor.ts` — 客户端访客身份 / 订阅 / 配额（localStorage）
- `lib/media.ts`、`lib/motionPhoto.ts` — 媒体类型判断与 Motion Photo 拆分
- `lib/types.ts` — 核心类型（`ChatMessage` 等）
- `components/` — UI 组件（PhoneShell、ChatBubble、VoiceBubble、AdminPanel 等）
- `supabase/schema.sql`、`supabase/motion-photo.sql` — 数据库 schema

## 数据模型要点

`messages` 单表承载所有消息，靠字段区分：
- `sender_kind`：`admin`（公开）/ `user`（私信）
- `visibility`：`public` / `private`
- `type`：`text | image | gif | voice | video | motion`
- `media_path` / `motion_video_path` / `media_duration`
- `is_deleted`：历史字段，现已改为硬删除（删消息时先删 Storage 文件再删行）；各读取查询的 `.eq("is_deleted", false)` 过滤保留无害。

RLS 对 anon 角色全部拒绝，数据访问只能经由服务端 API（service role）。

## 环境变量（见 `.env.example`）

`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、`NEXT_PUBLIC_SITE_NAME`。

> `SUPABASE_SERVICE_ROLE_KEY` 等服务端密钥严禁传给前端 / 加 `NEXT_PUBLIC_` 前缀。

另有 `SUPABASE_DB_URL`（仅存于 `.env.local`，不提交）：Postgres 直连串，供执行 DDL 迁移使用。

## Supabase 迁移 / DDL 操作方式

需要执行 `ALTER TABLE`、`ALTER TYPE` 等 DDL 时，用 `pg` 包通过 `SUPABASE_DB_URL` 直连数据库执行，**不走** PostgREST/service role。

```js
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = {};
for (const line of readFileSync(new URL("./.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const client = new Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
// 执行 SQL...
await client.end();
```

使用时临时 `npm install pg`，用完后 `npm uninstall pg` 移除。

## 常用命令

```bash
npm install
npm run dev      # next dev -H 0.0.0.0
npm run build
npm run lint
```

## 个人要求 / 工作偏好

- **用中文交流**：回复、代码注释、提交信息都用中文。
- **改动前先说明计划**：动手改代码前先讲清思路和涉及的文件，等确认后再写。
- **保持现有风格、最小改动**：遵循现有代码风格与命名，不擅自重构、不引入多余依赖，只做必要的改动。
- **改完跑 lint/build**：改动后运行 `npm run lint`（必要时 `npm run build`）自查后再交付。
- **可以主动修改 Supabase**：允许在需要时连接并修改 Supabase 数据 / 执行 SQL（涉及破坏性操作前先说明）。
