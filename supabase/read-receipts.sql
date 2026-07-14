-- Migration: count unique visitors who have read each idol broadcast.
-- Run this in the Supabase SQL editor after the messages table exists.

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  visitor_id text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, visitor_id)
);

create index if not exists message_reads_message_idx
  on public.message_reads(message_id);

alter table public.message_reads enable row level security;

create policy "no anon direct message read receipts"
on public.message_reads for all
to anon
using (false)
with check (false);
