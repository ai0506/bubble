-- Migration: add Android Motion Photo (Live Photo) support.
-- Run this in the Supabase SQL editor against an existing project.

-- 1. New message type for a still image that carries an embedded motion video.
alter type message_type add value if not exists 'motion';

-- 2. Path of the extracted motion video (mp4) in the chat-media bucket.
--    The still image keeps using `media_path`.
alter table public.messages add column if not exists motion_video_path text;
