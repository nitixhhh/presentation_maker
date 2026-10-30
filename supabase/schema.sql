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
