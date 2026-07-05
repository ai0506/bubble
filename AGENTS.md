# AGENTS.md

## 项目概述

这是 `bubble-mvp`（asw的Bubble），一个娱乐性的「竖屏聊天 / 订阅展示」MVP。**多爱豆**架构：爱豆与管理员是分离的两个角色。

- 访客端（`/`）：手机外壳里先是爱豆发现/选择页；`/?idol=<handle>` 进入与某爱豆的聊天，展示该爱豆发布的公开消息（文字 / 图片 / GIF / 语音 / 视频 / Motion Photo），「订阅」后可发私信。粉丝与某爱豆的聊天只看到「该爱豆广播 + 自己发的私信」，看不到其他粉丝。
- 爱豆端（`/idol`）：爱豆用 handle + 密码登录，进入聊天式发布界面。爱豆视角是「一个大群」：自己的公开广播 + 本频道所有粉丝发来的私信，按时间混排；爱豆只广播（不做定向回复），可删本频道任意消息。
- 管理端（`/admin`）：管理员用 `ADMIN_PASSWORD` 登录，只负责创建 / 停用 / 改密 / 删除爱豆，不再直接发消息。
- **没有真实账号系统（粉丝侧）**：访客身份用 `visitor_id` + 昵称，存在浏览器 `localStorage`；订阅、剩余条数也只是前端 localStorage 状态（按爱豆维度拆分，key 加 `:<idolId>` 后缀），纯娱乐效果，用户可自行篡改。爱豆账号则是数据库里的真实凭据（`idols.password_hash`，scrypt）。

简单理解：Supabase 像仓库，Next.js API 像仓库管理员，前端页面像手机聊天窗口。不要让浏览器直接拿到仓库总钥匙。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- Tailwind CSS 3
- Supabase：Postgres（`idols` + `messages` 两表）+ private Storage bucket `chat-media`，服务端用 `@supabase/supabase-js` 以 service role key 访问
- 阿里云 OSS：大体积媒体文件存储（详见 `docs/Plan_oss.md`）
- `lucide-react` 图标
- ESLint 9
- 部署面向 Vercel

## 主要目录

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
- `components/`：聊天界面、气泡、输入框、订阅遮罩、昵称弹窗、爱豆/管理面板等 UI 组件
- `scripts/`：OSS 迁移 / CORS 配置 / 图片压缩等一次性运维脚本
- `docs/`：历史技术方案文档（多爱豆改造、迁移 OSS、语音转文字等，功能均已合并，仅供追溯）
- `supabase/schema.sql`、`supabase/motion-photo.sql`、`supabase/multi-idol.sql` — 数据库 schema
- `public/`：静态资源

## 常用命令

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 构建检查：`npm run build`
- 代码检查：`npm run lint`

## 环境变量和安全要求

- `.env.local` 存本地真实配置，不要提交。
- `.env.example` 只放示例值。
- `SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用，绝不能传给前端组件或浏览器。
- `SUPABASE_DB_URL`：Postgres 直连串（含密码），仅存于 `.env.local`，供执行 DDL 迁移使用，不提交、不传前端。
- 普通用户写私信必须走 `/api/messages POST`，不要让前端直接写 Supabase。
- private Storage / OSS 只能降低原文件直接暴露风险；网页上已经展示过的图片、视频、音频，不能真正防止用户保存。
- 涉及媒体访问时，优先保持服务端代理、短时 signed URL、Range 支持等现有设计。

## Supabase DDL 迁移方式

需要执行 `ALTER TABLE`、`ALTER TYPE` 等 DDL 时，用 `pg` 包通过 `SUPABASE_DB_URL` 直连数据库执行，不走 PostgREST / service role。

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

用前临时 `npm install pg`，用完后 `npm uninstall pg` 移除。

## 数据模型要点

`idols` 表：每个爱豆一行，管理员后台创建。字段 `handle`（唯一，登录名/URL）、`display_name`、`avatar_path`、`bio`、`password_hash`（scrypt `"<saltHex>:<hashHex>"`）、`is_active`。默认爱豆 `handle='asw'`（存量数据回填目标）。

`messages` 表承载所有消息，靠字段区分：

- `idol_id`（not null，外键 → `idols.id`，`on delete cascade`）：这条消息属于哪个爱豆频道
- `sender_kind`：`admin`（爱豆广播，公开）/ `user`（粉丝私信）
- `visibility`：`public` / `private`
- `visitor_id`：访客本地身份标识
- `nickname`：访客昵称
- `type`：`text`、`image`、`gif`、`voice`、`video`、`motion`
- `media_path`：媒体文件路径
- `motion_video_path`：Motion Photo 附带视频路径（已通过 `supabase/motion-photo.sql` 迁移补充到线上库）
- `media_duration`：语音/视频时长
- `is_deleted`：历史字段，现已改为硬删除（删消息时先删 Storage 文件再删行）；各读取查询的 `.eq("is_deleted", false)` 过滤保留无害。

可见性规则：粉丝视图 = 某 `idol_id` 下「公开消息 + 自己 `visitor_id` 的私信」；爱豆视图（大群）= 某 `idol_id` 下全部消息。

当前约束重点：

- 爱豆消息（`sender_kind=admin`）必须是公开消息。
- 用户消息必须是私信、有 `visitor_id` 和昵称。
- 匿名 Supabase 客户端不能直接读写 `idols`、`messages`（RLS 全部拒绝 anon 角色），数据访问只能经由服务端 API（service role）。

## 开发注意事项

- 改动前先看现有组件和接口风格，尽量沿用已有结构。
- UI 以手机竖屏聊天体验为主，避免做成普通后台或营销页。
- 爱豆端、管理端和访客端逻辑要分清：爱豆/管理员权限在服务端判断，访客状态主要在浏览器本地保存。
- 修改数据库结构时，同步更新 `supabase/*.sql` 和相关 TypeScript 类型。
- 修改媒体逻辑时，要考虑图片、GIF、语音、视频、Motion Photo 的现有兼容。
- 修改聊天消息渲染时，要注意滚动到底部、媒体加载后高度变化、预览遮罩、水印等已有行为。
- 不要随意删除 `updates.md`，它是本项目的变更流水（本地文件，未纳入版本控制）。

## 个人协作要求

- 用户有编程基础，但不是高级工程师。遇到专业问题时，尽量用简单比喻解释。
- 回答时优先说清楚"为什么这样改"和"改了哪里"，不要只堆术语。
- 能直接完成的改动就直接完成，不要只给方案。
- 改动要小而稳，避免无关重构。
- 不要回滚用户已有改动，除非用户明确要求。
- 每次 CodeX 修改文件后，都要在同目录的 `updates.md` 追加一行 UTF-8 文本：

```text
[CodeX][YYMMDDHHMMSS] the updates
```

- 如果 `updates.md` 不存在，就创建它。
- 当用户要求"检查 updates"或类似说法时，读取并汇报 `updates.md`。

- GitHub upload workflow: when the user asks to upload to GitHub, run the necessary local checks first (at least lint; run build when build risk is involved). If local checks pass, automatically commit, push, create a PR, and merge it when GitHub reports it is mergeable. Only check GitHub mergeability/status for the merge decision; do not wait for or require Vercel checks.
