-- 037_archive_cascade.sql
--
-- Extends the client-archive soft-delete (migration 036) to projects,
-- quotes, and leads so archiving a client can cascade. Every table
-- gets the same `archived_at` timestamp column plus a partial index
-- for the "hide archived from default lists" scans.
--
-- Additive / idempotent. No data touched — just new nullable columns.

alter table public.projects
  add column if not exists archived_at timestamptz;
create index if not exists projects_archived_at_idx
  on public.projects (archived_at)
  where archived_at is not null;

alter table public.quotes
  add column if not exists archived_at timestamptz;
create index if not exists quotes_archived_at_idx
  on public.quotes (archived_at)
  where archived_at is not null;

alter table public.leads
  add column if not exists archived_at timestamptz;
create index if not exists leads_archived_at_idx
  on public.leads (archived_at)
  where archived_at is not null;
