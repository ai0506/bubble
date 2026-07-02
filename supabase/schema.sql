create extension if not exists pgcrypto;

create type message_sender_kind as enum ('admin', 'user');
create type message_visibility as enum ('public', 'private');
create type message_type as enum ('text', 'image', 'gif', 'voice', 'video', 'motion');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_kind message_sender_kind not null,
  visibility message_visibility not null,
  visitor_id text,
  nickname text,
  type message_type not null,
  content_text text,
  media_path text,
  motion_video_path text,
  media_duration integer,
  voice_transcript text,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false,

  constraint admin_public_messages check (
    sender_kind <> 'admin'
    or visibility = 'public'
  ),

  constraint user_private_messages check (
    sender_kind <> 'user'
    or (
      visibility = 'private'
      and visitor_id is not null
      and nickname is not null
      and type = 'text'
      and content_text is not null
      and media_path is null
    )
  )
);

create index messages_created_at_idx on public.messages(created_at);
create index messages_public_idx on public.messages(sender_kind, visibility, is_deleted, created_at);
create index messages_visitor_private_idx on public.messages(visitor_id, visibility, is_deleted, created_at);

alter table public.messages enable row level security;

create policy "no anon direct message reads"
on public.messages for select
to anon
using (false);

create policy "no anon direct message inserts"
on public.messages for insert
to anon
with check (false);

create policy "no anon direct message updates"
on public.messages for update
to anon
using (false);

create policy "no anon direct message deletes"
on public.messages for delete
to anon
using (false);
