# CLAUDE.md

本文件指导 Claude Code 在本仓库中工作。

## 项目是什么

**asw的Bubble** —— 一个娱乐性的「竖屏聊天 / 订阅展示」MVP（`package.json` 名为 `bubble-mvp`）。**多爱豆**架构：爱豆与管理员是分离的两个角色。

- 访客端（`/`）：手机外壳里先是爱豆发现/选择页；`/?idol=<handle>` 进入与某爱豆的聊天，展示该爱豆发布的公开消息（文字 / 图片 / GIF / 语音 / 视频 / Motion Photo），「订阅」后可发私信。粉丝与某爱豆的聊天只看到「该爱豆广播 + 自己发的私信」，看不到其他粉丝。
- 爱豆端（`/idol`）：爱豆用 handle + 密码登录，进入聊天式发布界面。爱豆视角是「一个大群」：自己的公开广播 + 本频道所有粉丝发来的私信，按时间混排；爱豆只广播（不做定向回复），可删本频道任意消息。
- 管理端（`/admin`）：管理员用 `ADMIN_PASSWORD` 登录，只负责创建 / 停用 / 改密 / 删除爱豆，不再直接发消息。
- **没有真实账号系统（粉丝侧）**：访客身份用 `visitor_id` + 昵称，存在浏览器 `localStorage`；订阅、剩余条数也只是前端 localStorage 状态（按爱豆维度拆分，key 加 `:<idolId>` 后缀），纯娱乐效果，用户可自行篡改。爱豆账号则是数据库里的真实凭据（`idols.password_hash`，scrypt）。

## 技术栈

- **Next.js 15**（App Router）+ **React 19** + **TypeScript**
- **Tailwind CSS 3**
- **Supabase**：Postgres（`idols` + `messages` 两表）+ private Storage bucket `chat-media`，服务端用 `@supabase/supabase-js` 以 service role key 访问
- `lucide-react` 图标
- 部署面向 Vercel

## 目录结构（关键部分）

- `app/page.tsx` — 访客入口（`VisitorApp`：发现页 `IdolDiscovery` / 聊天页 `ChatScreen`，用 `?idol=` 切换）
- `app/idol/page.tsx` — 爱豆端（`IdolConsole` + `IdolComposer`，聊天式发布）
- `app/admin/page.tsx` — 管理面板（`AdminPanel`，爱豆管理）
- `app/api/idols/route.ts` — 公开列出启用的爱豆（发现页用）
- `app/api/messages/route.ts` — 访客读取/发送消息（按 `idolId` 过滤/归属）
- `app/api/idol/login`、`logout`、`me` — 爱豆会话
- `app/api/idol/messages/route.ts` — 爱豆大群（GET）/ 发广播（POST）/ 删除（DELETE，限本频道）
- `app/api/idol/upload/route.ts` — 爱豆上传媒体（含 Motion Photo 拆分，路径前缀 `idolId`）
- `app/api/admin/idols/route.ts` — 爱豆 CRUD（GET/POST/PATCH/DELETE，需 admin）
- `app/api/admin/login`、`logout` — 管理员会话
- `app/api/admin/messages`、`upload`、`presign`、`record` — 旧管理端发布接口，已不被前端调用；仍保留且未传 `idolId` 时回退到默认爱豆 `asw`
- `app/api/media/file/route.ts`、`signed-url/route.ts` — 通过短期 signed URL 代理私有媒体
- `lib/supabaseAdmin.ts` — 服务端 Supabase client（service role）
- `lib/adminAuth.ts` — 管理员会话（HMAC-SHA256 签名 cookie）
- `lib/idolAuth.ts` — 爱豆会话（HMAC 签名，携带 `idolId`）+ 密码 scrypt 哈希/校验
- `lib/idols.ts` — 服务端爱豆解析（含默认爱豆 `asw` 回退）
- `lib/visitor.ts` — 客户端访客身份 / 订阅 / 配额（localStorage，按爱豆拆分）
- `lib/media.ts`、`lib/motionPhoto.ts` — 媒体类型判断与 Motion Photo 拆分
- `lib/types.ts` — 核心类型（`ChatMessage`、`Idol` 等）
- `components/` — UI 组件（PhoneShell、ChatBubble、VoiceBubble、VisitorApp、IdolDiscovery、IdolConsole、IdolComposer、AdminPanel 等）
- `scripts/` — OSS 迁移 / CORS 配置 / 图片压缩等一次性运维脚本
- `docs/` — 历史技术方案文档（多爱豆改造、迁移 OSS、语音转文字等，功能均已合并，仅供追溯）
- `supabase/schema.sql`、`supabase/motion-photo.sql`、`supabase/multi-idol.sql` — 数据库 schema

## 数据模型要点

`idols` 表：每个爱豆一行，管理员后台创建。字段 `handle`（唯一，登录名/URL）、`display_name`、`avatar_path`、`bio`、`password_hash`（scrypt `"<saltHex>:<hashHex>"`）、`is_active`。默认爱豆 `handle='asw'`（存量数据回填目标）。

`messages` 表承载所有消息，靠字段区分：
- `idol_id`（not null，外键 → `idols.id`，`on delete cascade`）：这条消息属于哪个爱豆频道
- `sender_kind`：`admin`（爱豆广播，公开）/ `user`（粉丝私信）
- `visibility`：`public` / `private`
- `type`：`text | image | gif | voice | video | motion`
- `media_path` / `motion_video_path` / `media_duration`
- `is_deleted`：历史字段，现已改为硬删除（删消息时先删 Storage 文件再删行）；各读取查询的 `.eq("is_deleted", false)` 过滤保留无害。

可见性规则：粉丝视图 = 某 `idol_id` 下「公开消息 + 自己 `visitor_id` 的私信」；爱豆视图（大群）= 某 `idol_id` 下全部消息。

RLS 对 anon 角色全部拒绝（`idols`、`messages` 皆是），数据访问只能经由服务端 API（service role）。

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
