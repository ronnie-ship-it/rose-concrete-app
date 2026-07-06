-- 042: Jobber → app schedule sync (crew-rebuild phase 1).
--
-- Jobber stays the system of record for scheduling. These columns let the
-- sync upsert Jobber visits/jobs/clients into our existing tables without
-- clobbering app-owned field data (photos, notes, status updates).

-- Jobber node ids on the three mirrored entities.
alter table public.clients  add column if not exists jobber_id text;
alter table public.projects add column if not exists jobber_id text;
alter table public.visits   add column if not exists jobber_id text;

create unique index if not exists clients_jobber_id_key  on public.clients (jobber_id)  where jobber_id is not null;
create unique index if not exists projects_jobber_id_key on public.projects (jobber_id) where jobber_id is not null;
create unique index if not exists visits_jobber_id_key   on public.visits (jobber_id)   where jobber_id is not null;

-- Jobber-owned display fields on visits. Kept separate from `notes`
-- (app-owned) so a re-sync never eats crew-entered notes.
alter table public.visits add column if not exists jobber_title text;
alter table public.visits add column if not exists jobber_instructions text;
alter table public.visits add column if not exists jobber_synced_at timestamptz;

-- Soft delete for visits that disappear from Jobber (rescheduled/removed).
-- Hard rule: never hard-delete user data.
alter table public.visits add column if not exists deleted_at timestamptz;
create index if not exists visits_deleted_idx on public.visits (deleted_at) where deleted_at is not null;

-- Sync run log — one row per run so failures are visible in the dashboard
-- instead of silently stale schedules.
create table if not exists public.jobber_sync_runs (
  id               uuid primary key default uuid_generate_v4(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  ok               boolean,
  visits_upserted  int not null default 0,
  visits_removed   int not null default 0,
  projects_upserted int not null default 0,
  clients_upserted int not null default 0,
  error            text
);
create index if not exists jobber_sync_runs_started_idx on public.jobber_sync_runs (started_at desc);
