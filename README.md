# asw的Bubble

一个娱乐性的竖屏聊天/订阅展示 MVP。普通访客不需要账号；`visitor_id`、昵称、订阅过期时间都存在浏览器 `localStorage`。

## Setup

1. 新建独立 Supabase Project，不要复用其他项目。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. 创建 private Storage bucket：`chat-media`。
4. 复制 `.env.example` 为 `.env.local`，填入 Supabase 和管理员环境变量。
5. 运行：

```bash
npm install
npm run dev
```

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量里，不能传给前端。
- 普通用户写私信必须走 `/api/messages POST`。
- 订阅只是前端娱乐效果，用户可以在自己的浏览器里改 localStorage。
- 媒体文件使用 private bucket 和短期 signed URL。这只能提高获取原文件的门槛，网页上展示过的媒体无法真正防下载。
