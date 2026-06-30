# Bubble-Like MVP Personal Site

## Summary
Build a new Next.js App Router MVP in `C:\Users\asw\Documents\bubble` using React, Tailwind, TypeScript, Supabase, and Vercel. The site is a phone-style “single-way chat/subscription display”: admin publishes public messages, users can view public messages after local simulated subscription, and subscribed users can send text-only private messages visible to themselves and admin.

No real accounts, no real payment, no user subscription data in Supabase. `visitor_id`, `nickname`, and subscription expiry live in `localStorage`.

## Project Structure
Create:

```txt
bubble/
  app/
    api/
      admin/
        login/route.ts
        logout/route.ts
        messages/route.ts
        upload/route.ts
      media/
        signed-url/route.ts
      messages/route.ts
    admin/page.tsx
    globals.css
    layout.tsx
    page.tsx
  components/
    AdminPanel.tsx
    ChatBubble.tsx
    ChatComposer.tsx
    ChatScreen.tsx
    DateDivider.tsx
    NicknameModal.tsx
    PhoneShell.tsx
    SubscribeOverlay.tsx
    VoiceBubble.tsx
  lib/
    adminAuth.ts
    dates.ts
    media.ts
    supabaseAdmin.ts
    types.ts
    visitor.ts
  supabase/
    schema.sql
  .env.example
  next.config.ts
  package.json
  postcss.config.mjs
  tailwind.config.ts
  tsconfig.json
  updates.md
```

Use `npm`, TypeScript, App Router, and Tailwind. Do not add a separate auth system or payment integration.

## Database, Storage, And Environment
Create a new independent Supabase project, not the existing Online Soup project.

`.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
NEXT_PUBLIC_SITE_NAME=Bubble MVP
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and used only inside Next.js API routes. It must never be imported into client components or sent to the browser.

`supabase/schema.sql`:

```sql
create extension if not exists pgcrypto;

create type message_sender_kind as enum ('admin', 'user');
create type message_visibility as enum ('public', 'private');
create type message_type as enum ('text', 'image', 'gif', 'voice', 'video');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_kind message_sender_kind not null,
  visibility message_visibility not null,
  visitor_id text,
  nickname text,
  type message_type not null,
  content_text text,
  media_path text,
  media_duration integer,
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
```

Storage:
- Create private bucket `chat-media`.
- Only admin upload APIs write to Storage.
- User private messages do not support uploads in MVP.
- Frontend asks `/api/media/signed-url` for short-lived signed URLs, e.g. 10 minutes.
- Add setup note that signed URLs only raise the access barrier; displayed browser media cannot be fully download-proof.

## Key Implementation
User page `/`:
- Use `PhoneShell` for a fixed vertical mobile container: mobile fills screen, desktop centered at about `430px`.
- `visitor.ts` manages:
  - `bubble_visitor_id`
  - `bubble_nickname`
  - `bubble_subscription_expires_at`
- If `visitorId` is missing, create it client-side with `crypto.randomUUID()` before any `/api/messages` call.
- First visit asks for nickname in `NicknameModal`; nickname stays local.
- Subscription is local-only:
  - unpaid state shows blurred chat plus subscription overlay
  - clicking subscribe writes one year later to `bubble_subscription_expires_at`
  - unexpired timestamp unlocks blur and enables `ChatComposer`
  - missing or expired timestamp shows overlay and disables `ChatComposer`
- `/api/messages?visitorId=...` returns:
  - admin public undeleted messages
  - current visitor’s own private undeleted messages
- User composer sends only text private messages with `{ visitorId, nickname, contentText }`, and the UI prevents sending while unsubscribed or expired.

User `/api/messages`:
- `GET`: requires `visitorId`; returns messages where:
  - `sender_kind='admin' and visibility='public' and is_deleted=false`
  - OR `sender_kind='user' and visibility='private' and visitor_id=visitorId and is_deleted=false`
- `POST`: validates `visitorId`, `nickname`, and `contentText`; inserts:
  - `sender_kind='user'`
  - `visibility='private'`
  - `type='text'`
  - `visitor_id`, `nickname`, `content_text`

Admin `/admin`:
- Password form posts to `/api/admin/login`.
- On success, server stores a signed session token in an HTTP-only cookie, not the raw `ADMIN_PASSWORD`.
- `adminAuth.ts` signs/verifies the cookie with `ADMIN_SESSION_SECRET`, e.g. HMAC over a small payload containing purpose and expiry.
- `/api/admin/logout` clears the cookie.
- `/api/admin/messages GET` returns all undeleted messages, including admin public messages and every user private message.
- Admin list displays nickname, visitor_id, message content/media type, and send time.
- Admin can publish text, image, GIF, and voice as:
  - `sender_kind='admin'`
  - `visibility='public'`
- Admin can soft-delete messages by setting `is_deleted=true`.

Media:
- Admin uploads image/GIF/voice through `/api/admin/upload`.
- API stores file in private `chat-media` bucket and inserts a public admin message with `media_path`.
- Image/GIF render as chat media bubbles.
- Voice renders as a custom voice bar with play button and duration, using hidden media element; no original filename and no native controls.

After implementation, append to `updates.md` using UTF-8:

```txt
[CodeX][YYMMDDHHMMSS] scaffolded Bubble-style MVP with local-only subscription, private user text messages, admin signed session cookie, admin media publishing, signed storage URLs, and phone chat UI
```

## Test Plan
Run:

```bash
npm install
npm run lint
npm run build
npm run dev
```

Manual checks:
- First visit creates local visitor ID before fetching messages.
- First visit asks for nickname.
- Refresh keeps visitor ID and nickname.
- Subscription is not written to Supabase.
- No `users` table is required.
- Expired or missing `bubble_subscription_expires_at` shows blur overlay.
- Chat composer is disabled when subscription is missing or expired.
- Clicking subscribe writes a one-year local expiry, unlocks blur, and enables composer.
- User can send text-only private message after local subscription.
- User sees admin public messages and their own private messages only.
- Admin cookie contains a signed session token, not `ADMIN_PASSWORD`.
- Admin sees all undeleted messages, including all user private messages with nickname and visitor ID.
- Admin can publish text/image/GIF/voice.
- Uploaded media uses private Storage plus signed URLs.
- `SUPABASE_SERVICE_ROLE_KEY` appears only in server-side files.
- Supabase anon role cannot directly read, insert, update, or delete `messages`.

## Assumptions
- Subscription is only a front-end entertainment effect and can be changed by users in their browser.
- User identity is localStorage-based and not secure authentication.
- User private messages are text-only for MVP.
- Video field remains supported in schema but full video UI is deferred.
- RLS blocks anon direct table access; all normal app data access goes through Next.js API routes using the server-only service role key.
