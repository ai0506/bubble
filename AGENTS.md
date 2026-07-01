# AGENTS.md

## 项目概述

这是 `bubble-mvp`，一个面向竖屏手机体验的聊天 / 订阅展示 MVP。

项目的核心目标是做一个类似私密聊天展示页的 Web 应用：

- 普通访客打开首页后，以手机壳样式看到聊天内容。
- 访客不需要注册账号，`visitor_id`、昵称、订阅状态和剩余发言次数主要保存在浏览器 `localStorage`。
- 未订阅用户会看到订阅遮罩；订阅目前更像前端演示效果，不是强安全付费系统。
- 订阅后访客可以发送私信文本消息。
- 管理员通过 `/admin` 页面发布公开消息、上传媒体、查看或管理消息。
- 媒体文件使用 Supabase private Storage bucket，并通过服务端 API 生成短时访问或同源代理访问。

简单理解：Supabase 像仓库，Next.js API 像仓库管理员，前端页面像手机聊天窗口。不要让浏览器直接拿到仓库总钥匙。

## 技术栈

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase
  - Postgres 存储消息
  - Row Level Security 禁止匿名用户直接读写 `messages`
  - private Storage bucket 存储聊天媒体
- `@supabase/ssr` 和 `@supabase/supabase-js`
- `lucide-react` 图标
- ESLint 9

## 主要目录

- `app/page.tsx`：访客聊天首页。
- `app/admin/page.tsx`：管理员页面。
- `app/api/messages/route.ts`：普通访客读取消息、发送私信的入口。
- `app/api/admin/*`：管理员登录、登出、消息管理、上传等接口。
- `app/api/media/*`：媒体文件访问、签名 URL、同源代理相关接口。
- `components/`：聊天界面、气泡、输入框、订阅遮罩、昵称弹窗、管理面板等 UI 组件。
- `lib/`：Supabase 管理客户端、访客 localStorage 逻辑、日期、媒体、类型等工具。
- `supabase/schema.sql`：数据库表、枚举、索引和 RLS 策略。
- `supabase/motion-photo.sql`：Motion Photo / Live Photo 相关数据库补充。
- `public/`：静态资源。

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
- private Storage 只能降低原文件直接暴露风险；网页上已经展示过的图片、视频、音频，不能真正防止用户保存。
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

`messages` 表是核心表，主要字段包括：

- `sender_kind`：`admin` 或 `user`
- `visibility`：`public` 或 `private`
- `visitor_id`：访客本地身份标识
- `nickname`：访客昵称
- `type`：`text`、`image`、`gif`、`voice`、`video`、`motion`
- `media_path`：媒体文件路径
- `motion_video_path`：Motion Photo 附带视频路径
- `is_deleted`：历史字段，现已改为硬删除（删消息时先删 Storage 文件再删行）；各读取查询的 `.eq("is_deleted", false)` 过滤保留无害。
- `motion_video_path`：Motion Photo 附带视频路径（已通过 `supabase/motion-photo.sql` 迁移补充到线上库）

当前约束重点：

- 管理员消息必须是公开消息。
- 用户消息必须是私信、文本、有 `visitor_id` 和昵称。
- 匿名 Supabase 客户端不能直接读写 `messages`。

## 开发注意事项

- 改动前先看现有组件和接口风格，尽量沿用已有结构。
- UI 以手机竖屏聊天体验为主，避免做成普通后台或营销页。
- 管理端和访客端逻辑要分清：管理员权限在服务端判断，访客状态主要在浏览器本地保存。
- 修改数据库结构时，同步更新 `supabase/*.sql` 和相关 TypeScript 类型。
- 修改媒体逻辑时，要考虑图片、GIF、语音、视频、Motion Photo 的现有兼容。
- 修改聊天消息渲染时，要注意滚动到底部、媒体加载后高度变化、预览遮罩、水印等已有行为。
- 不要随意删除 `updates.md`，它是本项目的变更流水。

## 个人协作要求

- 用户有编程基础，但不是高级工程师。遇到专业问题时，尽量用简单比喻解释。
- 回答时优先说清楚“为什么这样改”和“改了哪里”，不要只堆术语。
- 能直接完成的改动就直接完成，不要只给方案。
- 改动要小而稳，避免无关重构。
- 不要回滚用户已有改动，除非用户明确要求。
- 每次 CodeX 修改文件后，都要在同目录的 `updates.md` 追加一行 UTF-8 文本：

```text
[CodeX][YYMMDDHHMMSS] the updates
```

- 如果 `updates.md` 不存在，就创建它。
- 当用户要求“检查 updates”或类似说法时，读取并汇报 `updates.md`。

- GitHub upload workflow: when the user asks to upload to GitHub, run the necessary local checks first (at least lint; run build when build risk is involved). If local checks pass, automatically commit, push, create a PR, and merge it when GitHub reports it is mergeable. Only check GitHub mergeability/status for the merge decision; do not wait for or require Vercel checks.
