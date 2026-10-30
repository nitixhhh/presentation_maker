-- =====================================================================
-- DeckCraft AI — Supabase schema (Engine v3)
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE everywhere).
--
-- The server talks to these tables with SUPABASE_SERVICE_ROLE_KEY (server env only,
-- never in the browser). RLS is ON for every table, so the public anon key can only
-- read what the policies below allow (a signed-in user's own rows) and can write nothing.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Generation jobs (one row per deck request)
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id           text primary key,                 -- random, unguessable job id
  owner_key    text not null,                    -- anonymous browser key, or "u:<user id>"
  user_id      uuid references auth.users(id) on delete set null,
  status       text not null default 'queued' check (status in ('queued','running','done','failed')),
  request      jsonb not null,                   -- topic, slide count, language, presenter details...
  progress     jsonb not null default '{}'::jsonb,
  title        text,
  deck_id      text,                             -- folder name inside the "decks" bucket
  error        text,
  attempt      int  not null default 0,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists jobs_status_idx   on public.jobs (status, created_at);
create index if not exists jobs_owner_idx    on public.jobs (owner_key, created_at desc);
create index if not exists jobs_user_idx     on public.jobs (user_id, created_at desc);
create index if not exists jobs_finished_idx on public.jobs (finished_at desc) where status = 'done';

alter table public.jobs enable row level security;

drop policy if exists "users read own jobs" on public.jobs;
create policy "users read own jobs" on public.jobs
  for select to authenticated
  using (user_id = auth.uid());
-- no insert/update/delete policies: only the server (service role) writes.

-- ---------------------------------------------------------------------
-- 2. Storage bucket for deck files (deck.json, images, PDF, PPTX)
--    PRIVATE: files are only served through the server (and, after payment,
--    through short-lived signed URLs the server creates).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('decks', 'decks', false, 52428800)          -- 50 MB per file
on conflict (id) do update set public = false;

-- No storage.objects policies for anon/authenticated on this bucket = no direct access.
-- (The service role bypasses RLS, so the server can read/write.)

-- ---------------------------------------------------------------------
-- 3. Housekeeping: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- (Accounts, payments, credits and referrals tables are added below in the
--  "Phase 4" section once that phase lands.)


-- ─────────────────────────────────────────────────────────────────────────────
-- Accounts + payments (Phase 4). Only the server (service-role key) reads/writes these;
-- RLS is on with no policies, so the public anon key cannot touch them.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  name           text,
  referral_code  text unique not null,
  referred_by    uuid references auth.users (id),
  created_at     timestamptz not null default now()
);

create table if not exists public.credit_events (
  id         bigserial primary key,
  owner_key  text not null,               -- "u:<user id>"
  delta      integer not null,            -- +5 pack, +1 referral, -1 unlock
  reason     text not null,
  ref        text unique not null,        -- idempotency key (order id, referral, use)
  created_at timestamptz not null default now()
);
create index if not exists credit_events_owner_idx on public.credit_events (owner_key);

create table if not exists public.orders (
  id                   text primary key,
  owner_key            text not null,
  user_id              uuid,
  product              text not null check (product in ('deck','pack5')),
  deck_id              text,
  amount               integer not null,  -- paise
  currency             text not null default 'INR',
  provider             text not null,      -- razorpay | cashfree | …
  provider_order_id    text unique not null,
  provider_payment_id  text,
  status               text not null default 'created' check (status in ('created','paid','failed')),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);
create index if not exists orders_owner_idx on public.orders (owner_key, created_at desc);

create table if not exists public.unlocks (
  owner_key  text not null,
  deck_id    text not null,
  via        text not null,                -- payment | credit | free-first
  ref        text,
  created_at timestamptz not null default now(),
  primary key (owner_key, deck_id)
);

create table if not exists public.deck_edits (
  deck_id text primary key,
  count   integer not null default 0
);

alter table public.profiles      enable row level security;
alter table public.credit_events enable row level security;
alter table public.orders        enable row level security;
alter table public.unlocks       enable row level security;
alter table public.deck_edits    enable row level security;
