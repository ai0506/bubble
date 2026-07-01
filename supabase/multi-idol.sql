-- 多爱豆改造 schema（见 Plan_multi-idol.md）
-- 在 schema.sql / motion-photo.sql 之后执行。

-- 1. idols 表：每个爱豆一行，管理员后台创建
create table if not exists public.idols (
  id            uuid primary key default gen_random_uuid(),
  handle        text not null unique,          -- URL / 登录名，如 'asw'，校验 ^[a-z0-9_-]{2,32}$
  display_name  text not null,
  avatar_path   text,                          -- chat-media 内路径，可空
  bio           text,
  password_hash text not null,                 -- scrypt: "<saltHex>:<hashHex>"
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.idols enable row level security;

-- 与 messages 一致：anon 全拒绝，仅服务端 service role 访问
create policy "no anon idol reads"   on public.idols for select to anon using (false);
create policy "no anon idol inserts" on public.idols for insert to anon with check (false);
create policy "no anon idol updates" on public.idols for update to anon using (false);
create policy "no anon idol deletes" on public.idols for delete to anon using (false);

-- 2. messages 加 idol_id：消息归属哪个爱豆频道
alter table public.messages
  add column if not exists idol_id uuid references public.idols(id) on delete cascade;

-- 频道维度索引：爱豆大群 & 粉丝按爱豆过滤都会用到
create index if not exists messages_idol_public_idx
  on public.messages(idol_id, sender_kind, visibility, is_deleted, created_at);
create index if not exists messages_idol_visitor_idx
  on public.messages(idol_id, visitor_id, visibility, is_deleted, created_at);

-- 3. 回填完成、写入路径都带上 idol_id 后执行（已应用）：
alter table public.messages alter column idol_id set not null;
