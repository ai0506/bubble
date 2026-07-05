# 多爱豆改造技术方案（Plan: Multi-Idol）

> 目标：从「单爱豆（=管理员）」演进到「多爱豆」，并**分离爱豆与管理员两个角色**。
> 爱豆拥有一套聊天风格的发布界面，粉丝可选择订阅/查看不同爱豆。
> 
> 本文档为技术方案 + 待办清单，实施分 P0–P3 四个阶段。

---

## 0. 已确认的产品决策

1. **爱豆账号**：由**管理员在后台创建**并分配登录凭据，不做注册/审核流程。
2. **私信可见性规则**：
   - 粉丝 A 发给爱豆 B 的消息，**只有 A 和 B 可见**。
   - **爱豆视角**：没有独立"私信箱"，而是**一个大群** —— 自己发的广播 + 所有粉丝发来的消息，按时间混排在一条流里。
   - **粉丝视角**：可订阅多个爱豆；与某爱豆的聊天里只看到「该爱豆广播 + 自己发的私信」，看不到其他粉丝。
   - **爱豆只广播，不做定向回复**：爱豆发出的每条消息都是对该频道所有粉丝可见的公开消息。
3. **订阅 / 配额**：继续纯前端 `localStorage` 娱乐效果，但需按**爱豆维度**拆分。
4. **默认爱豆**：存量消息、旧接口未传 `idol_id` 的消息，都默认归到 `handle='asw'` 的爱豆。
5. **粉丝入口**：
   - `/` 展示全部启用爱豆的发现/选择页。
   - `/?idol=asw` 进入 asw 的聊天页；其他爱豆同理。
6. **管理员职责**：管理员只负责创建 / 停用 / 改密 / 删除爱豆，不再作为爱豆直接发布消息。
7. **爱豆删消息权限**：爱豆可以删除自己频道内的任意消息，包括自己发的广播和粉丝发来的私信。
8. **爱豆资料**：需要头像 / 简介字段；头像展示需通过 signed URL 或同源代理，不能把 private Storage 路径直接当图片 URL 用。

---

## 1. 现状基线（改造前）

| 维度   | 现状                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------- |
| 数据表  | 单张 `public.messages`，无爱豆概念                                                                     |
| 爱豆广播 | `sender_kind='admin'` + `visibility='public'`                                                  |
| 粉丝私信 | `sender_kind='user'` + `visibility='private'` + `visitor_id`，约束限定**纯文本**（`media_path` 必须 null） |
| 鉴权   | 单一管理员：`ADMIN_PASSWORD` + HMAC 签名 cookie（`lib/adminAuth.ts`），管理员即唯一爱豆                           |
| 粉丝读取 | `GET /api/messages?visitorId=` → 全部 admin 公开消息 + 自己的私信合并                                       |
| 粉丝端  | `components/ChatScreen.tsx`，订阅/配额/昵称全在 localStorage（`lib/visitor.ts`）                          |
| 管理端  | `components/AdminPanel.tsx`，后台管理风格（发布表单 + 收/发消息两栏）                                             |
| 媒体   | private bucket `chat-media`，经 `/api/media/*` 短期 signed URL 代理                                  |

**关键洞察**：现有可见性模型天然贴合目标规则，缺的只是给消息加一个"归属哪个爱豆"的字段 `idol_id`。爱豆的"大群"= 该 `idol_id` 下所有消息（不按 visitor 过滤）；粉丝视图 = 该 `idol_id` 下「公开消息 + 自己 visitor_id 的私信」。

---

## 2. 数据模型改造

### 2.1 新增 `idols` 表

```sql
create table public.idols (
  id            uuid primary key default gen_random_uuid(),
  handle        text not null unique,          -- URL / 登录名，如 'asw'；建议校验 ^[a-z0-9_-]{2,32}$
  display_name  text not null,
  avatar_path   text,                          -- chat-media 内路径，可空
  bio           text,
  password_hash text not null,                 -- scrypt(salt + password)，见 §3.2
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.idols enable row level security;
-- 与 messages 一致：anon 全拒绝，仅服务端 service role 访问
create policy "no anon idol reads"   on public.idols for select to anon using (false);
create policy "no anon idol inserts" on public.idols for insert to anon with check (false);
create policy "no anon idol updates" on public.idols for update to anon using (false);
create policy "no anon idol deletes" on public.idols for delete to anon using (false);
```

### 2.2 `messages` 表加 `idol_id`

```sql
alter table public.messages
  add column idol_id uuid references public.idols(id) on delete cascade;

-- 回填后再设 not null（见 §7 迁移步骤）
-- alter table public.messages alter column idol_id set not null;

-- 频道维度索引：爱豆大群 & 粉丝按爱豆过滤都要用
create index messages_idol_public_idx
  on public.messages(idol_id, sender_kind, visibility, is_deleted, created_at);
create index messages_idol_visitor_idx
  on public.messages(idol_id, visitor_id, visibility, is_deleted, created_at);
```

**约束调整**：现有 `admin_public_messages` / `user_private_messages` 两个 CHECK 保留，语义不变；`idol_id` 通过上面的 `set not null` 强制两类消息都必须归属某爱豆。`sender_kind` 枚举**保持不变**（`'admin'` 语义读作"频道主/爱豆广播"，避免 `ALTER TYPE RENAME` 的兼容成本）。

### 2.3 媒体存储路径

爱豆媒体路径加 `idol_id` 前缀便于归类与清理：

```
{idolId}/{type}/{YYYY-MM-DD}/{uuid}.{ext}
{idolId}/motion/{YYYY-MM-DD}/{uuid}.jpg  +  _video.mp4
```

> 粉丝私信仍是纯文本（约束不放开），故不涉及粉丝上传媒体。

### 2.4 类型定义（`lib/types.ts`）

```ts
export type Idol = {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
};

// ChatMessage 增加：
//   idol_id: string;
```

---

## 3. 鉴权 / 角色分离

两个独立会话，互不影响。

### 3.1 超级管理员（沿用现有）

- `ADMIN_PASSWORD` + HMAC cookie（`lib/adminAuth.ts`，`ADMIN_COOKIE_NAME = bubble_admin_session`）。
- 职责收窄为：**管理爱豆账号**（创建 / 停用 / 改密），不再直接发消息。

### 3.2 爱豆会话（新增 `lib/idolAuth.ts`）

- 复用 `adminAuth.ts` 的 HMAC 签名套路，payload 改为 `{ purpose: "idol", idolId, exp }`。
- 新 cookie：`bubble_idol_session`。
- 登录：`POST /api/idol/login { handle, password }` → 查 `idols` 按 handle → 用 scrypt 校验 `password_hash` → 签发带 `idolId` 的 token。
- 密码哈希用 **node:crypto `scrypt`**（不引第三方依赖）：

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  const hash = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
```

- 辅助：`requireIdol()` → 返回 `{ idolId }` 或 401，供 `/api/idol/*` 复用（对标现有 `requireAdmin()`）。

---

## 4. API 契约

### 4.1 粉丝端（公开）

| 方法   | 路径                                 | 说明                                                                         |
| ---- | ---------------------------------- | -------------------------------------------------------------------------- |
| GET  | `/api/idols`                       | 列出 `is_active=true` 的爱豆（`id, handle, display_name, avatar_path, bio`），供发现页 |
| GET  | `/api/messages?visitorId=&idolId=` | 返回该 `idol_id` 下「公开消息 + 本 visitor 私信」，按时间升序                                 |
| POST | `/api/messages`                    | body 增 `idolId`；插入粉丝私信（`sender_kind=user, visibility=private, idol_id`）    |

`GET /api/messages` 查询条件（改自现 `route.ts:25`）：

```
.eq("idol_id", idolId)
.or(
  `and(sender_kind.eq.admin,visibility.eq.public),` +
  `and(sender_kind.eq.user,visibility.eq.private,visitor_id.eq.${visitorId})`
)
```

POST 校验：`idolId` 必须存在且 `is_active`（防止往已停用/不存在的爱豆发消息）。

过渡兼容：迁移期间如果旧前端 / 旧接口没有传 `idolId`，服务端先回退到默认爱豆 `asw`。等粉丝端完成多爱豆改造并稳定后，再把 `idolId` 改成强制必传。

### 4.2 爱豆端（需爱豆 session）

| 方法     | 路径                   | 说明                                                          |
| ------ | -------------------- | ----------------------------------------------------------- |
| POST   | `/api/idol/login`    | `{ handle, password }` → 签发 idol cookie                     |
| POST   | `/api/idol/logout`   | 清 cookie                                                    |
| GET    | `/api/idol/me`       | 返回当前登录爱豆信息（渲染头部用）                                           |
| GET    | `/api/idol/messages` | 本频道**大群**：`idol_id=session.idolId` 的所有消息（广播+全部粉丝私信），时间升序    |
| POST   | `/api/idol/messages` | 发文字广播（`sender_kind=admin, visibility=public, idol_id=self`） |
| POST   | `/api/idol/upload`   | 发媒体广播，复刻现 `admin/upload`，路径前缀 `idolId`，`idol_id=self`       |
| DELETE | `/api/idol/messages` | 删本频道消息，**强制 `idol_id=session.idolId`**（防跨频道删除）；范围见 Q2       |

### 4.3 管理端（需 admin session）

| 方法     | 路径                 | 说明                                                         |
| ------ | ------------------ | ---------------------------------------------------------- |
| GET    | `/api/admin/idols` | 列出全部爱豆（含停用）                                                |
| POST   | `/api/admin/idols` | 创建：`{ handle, displayName, password }` → `hashPassword` 落库 |
| PATCH  | `/api/admin/idols` | 停用/启用、改名、重置密码                                              |
| DELETE | `/api/admin/idols` | 删除爱豆（`on delete cascade` 会连带删消息；删前需清理该爱豆 Storage 文件，见 §6）  |

> 现有 `/api/admin/messages`、`/api/admin/upload` 发布逻辑**迁移**到 `/api/idol/*`；如需管理员全局审核可保留只读版本，非必需。
> 迁移过渡期内，旧 `/api/admin/messages`、`/api/admin/upload` 若尚未移除，应把新消息默认写入 `asw` 的 `idol_id`，避免 `messages.idol_id not null` 后旧发布入口报错。

---

## 5. 前端改造

### 5.1 粉丝端（`app/page.tsx` / `components/ChatScreen.tsx`）

- **发现/选择页**：手机壳内列出爱豆（来自 `/api/idols`），点击进入与该爱豆的聊天。
- **路由**：`/?idol=<handle>`（默认），无 idol 参数时展示发现页。
- **`ChatScreen` 接收 `idolId`**，`loadMessages` 带上 `idolId`。
- **订阅 / 配额按爱豆拆分**（改 `lib/visitor.ts`）：localStorage key 后缀带 idolId，例如：
  - `bubble_subscription_expires_at:<idolId>`
  - `bubble_remaining_messages:<idolId>`
  - `bubble_last_admin_message_id:<idolId>`
  - `bubble_visitor_id` / `bubble_nickname` 保持全局（同一访客身份）。
- 未订阅某爱豆时，沿用现有"模糊 + SubscribeOverlay"逻辑，但作用于**该爱豆**。

### 5.2 爱豆端（新增 `app/idol/`）

- `app/idol/page.tsx`（或 `app/idol/[handle]/page.tsx`）：
  - **登录页**（未登录时）：handle + 密码。
  - **聊天风格发布界面**（登录后）：这是"爱豆前端也不能太差"的核心。
    - 复用 `PhoneShell` / `ChatBubble` / `VoiceBubble` 的视觉语言，把大群渲染成真实聊天：
      - **粉丝消息靠左**，带昵称（因为是大群，需区分不同粉丝）。
      - **自己（爱豆）消息靠右**。
    - 底部 composer 支持文字 + 媒体（图片/GIF/语音/视频/实况），复用 `ChatComposer` + `admin/upload` 的上传逻辑。
    - 媒体上传时保持现有 Storage 私有桶设计；如果文件上传成功但数据库插入失败，要删除刚上传的文件，避免留下孤立文件。
    - 顶部显示爱豆名/头像、刷新、退出。
- 组件复用建议：抽出可共享的气泡/日期分隔，避免与粉丝端重复。

### 5.3 管理端（`components/AdminPanel.tsx`）

- **移除**现有发布表单（迁到爱豆端）。
- 改造为**爱豆管理**：
  - 爱豆列表（名/handle/状态/创建时间）。
  - 新建爱豆（display_name + handle + 初始密码）。
  - 停用 / 启用、重置密码、删除（删除需二次确认，说明会连带删消息+媒体）。

---

## 6. 删除 / 清理逻辑

- **删单条消息**（爱豆端 DELETE）：沿用现有"先删 Storage 文件再删行"（`admin/messages/route.ts:82`），但查询与删除都限定 `idol_id=session.idolId`。
- **删爱豆**（管理端 DELETE）：`on delete cascade` 会删数据库消息行，但**不会**自动删 Storage 文件。需在删爱豆前：
  1. 查出该 `idol_id` 全部消息的 `media_path` / `motion_video_path`；
  2. 批量 `storage.remove(paths)`；
  3. 再删 `idols` 行（触发级联删消息）。

---

## 7. 迁移步骤（DDL）

按 `CLAUDE.md` 用 `pg` 直连 `SUPABASE_DB_URL` 执行（临时 `npm install pg`，用完 `npm uninstall pg`）：

1. `create table public.idols ...`（含 RLS 策略）。
2. `alter table public.messages add column idol_id uuid references public.idols(id) on delete cascade;`
3. **建默认爱豆**（代表当前 asw）：`insert into idols(handle, display_name, password_hash) values ('asw', 'asw', <hashPassword(临时密码)>) returning id;`
4. **回填**：`update messages set idol_id = <默认爱豆id> where idol_id is null;`
5. 先把所有写消息的旧接口加上默认 `asw` 回退：没传 `idolId` 时写入默认爱豆。
6. 确认新旧写入路径都能写入 `idol_id` 后，再执行 `alter table messages alter column idol_id set not null;`
7. 建索引 `messages_idol_public_idx`、`messages_idol_visitor_idx`。
8. 更新 `supabase/schema.sql`、`supabase/motion-photo.sql`（或新增 `supabase/multi-idol.sql`）以反映最终结构。

> 存量粉丝私信原本无 idol 归属，回填后统一挂到默认爱豆，符合"以前只有一个爱豆"的历史语义。

---

## 8. 文件影响清单

| 文件                                           | 动作                                  |
| -------------------------------------------- | ----------------------------------- |
| `supabase/multi-idol.sql`                    | 新增（idols 表 + messages.idol_id + 索引） |
| `lib/types.ts`                               | 改（加 `Idol`、`ChatMessage.idol_id`）   |
| `lib/idolAuth.ts`                            | 新增（爱豆会话 + 密码哈希/校验）                  |
| `lib/visitor.ts`                             | 改（订阅/配额 key 按 idolId 拆分）            |
| `app/api/idols/route.ts`                     | 新增（GET 爱豆列表）                        |
| `app/api/messages/route.ts`                  | 改（GET/POST 加 idolId 过滤/归属）          |
| `app/api/idol/login/route.ts`、`logout`       | 新增                                  |
| `app/api/idol/me/route.ts`                   | 新增                                  |
| `app/api/idol/messages/route.ts`             | 新增（GET 大群 / POST 广播 / DELETE）       |
| `app/api/idol/upload/route.ts`               | 新增（复刻 admin/upload，路径带 idolId）      |
| `app/api/admin/idols/route.ts`               | 新增（爱豆 CRUD）                         |
| `app/api/admin/messages`、`admin/upload`      | 保留只读或移除发布能力                         |
| `app/page.tsx` / `components/ChatScreen.tsx` | 改（发现页 + idolId 作用域）                 |
| `app/idol/page.tsx` + 新组件                    | 新增（爱豆登录 + 聊天式发布）                    |
| `components/AdminPanel.tsx`                  | 改（改造为爱豆管理）                          |

---

## 9. 分阶段待办清单

### P0 — 数据迁移与基础 ✅

- [x] 编写并执行 `idols` 表 DDL（含 RLS）
- [x] `messages` 加 `idol_id` 列
- [x] 建默认爱豆 `asw` 行 + 回填存量消息 `idol_id`（初始密码 `asw123456`，请尽快在 /admin 重置）
- [x] 旧消息写入接口补默认 `asw` 回退后，再设 `idol_id not null`
- [x] 建 idol 维度索引
- [x] 更新 `supabase/*.sql` 记录最终结构（`supabase/multi-idol.sql`）
- [x] `lib/types.ts` 增 `Idol` 与 `ChatMessage.idol_id`

### P1 — 爱豆角色（鉴权 + API + 聊天式界面）✅

- [x] `lib/idolAuth.ts`：密码哈希/校验、会话签发/校验、`requireIdol()`
- [x] `/api/idol/login`、`logout`、`me`
- [x] `/api/idol/messages`（GET 大群 / POST 广播 / DELETE）
- [x] `/api/idol/upload`（含 motion 拆分，路径带 idolId）
- [x] `app/idol/` 登录页
- [x] 爱豆聊天式发布界面（大群渲染 + composer + 媒体上传）
- [x] `npm run lint` / `build` 自查

### P2 — 粉丝多爱豆 ✅

- [x] `/api/idols` 列表接口
- [x] `GET/POST /api/messages` 加 `idolId`
- [x] 粉丝发现/选择页（`/?idol=<handle>` 路由）
- [x] `ChatScreen` 接收并作用于 `idolId`
- [x] `lib/visitor.ts` 订阅/配额按 idolId 拆分
- [x] 未订阅遮罩按爱豆生效
- [x] `npm run lint` / `build` 自查

### P3 — 管理后台（爱豆管理）✅

- [x] `/api/admin/idols` CRUD（创建含 `hashPassword`）
- [x] 删爱豆前清理其 Storage 媒体
- [x] `AdminPanel` 改造为爱豆管理 UI（新建/停用/改密/删除 + 二次确认）
- [x] 移除/收窄管理端原发布能力（AdminPanel 不再调用旧发布接口；接口保留 + asw 回退）
- [x] `npm run lint` / `build` 自查

### 收尾 ✅

- [x] `.env.example` / 文档更新（无新增环境变量，爱豆会话复用 `ADMIN_SESSION_SECRET`）
- [x] 更新 `CLAUDE.md` 项目描述（单爱豆 → 多爱豆、角色分离）
- [x] 端到端手测：/api 层已验证 —— 爱豆登录 / 大群 / 广播归属 / 粉丝私信隔离 / 爱豆可见全部私信 均通过

### 后续可选增强（未做）

- [ ] 爱豆头像 / 简介的上传与展示（当前发现页与聊天头像用首字母占位，`ChatBubble` 内爱豆头像仍是静态 `/profile_image.webp`）
- [ ] 待多爱豆前端稳定后，把 `/api/messages` 的 `idolId` 由「缺省回退 asw」改为强制必传
- [ ] 移除已停用的旧管理端发布接口（`/api/admin/messages|upload|presign|record`）
