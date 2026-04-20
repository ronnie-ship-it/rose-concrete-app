-- Rose Concrete — Jobber GraphQL API importer dedupe keys
--
-- The API importer pulls notes and attachments directly from Jobber and
-- needs deterministic dedupe so re-running it is a safe no-op. Both
-- tables get an `external_id` column that captures Jobber's GraphQL node
-- id, plus a partial unique index so nothing stops you from keeping
-- native-app-created rows (external_id null) alongside Jobber-imported
-- ones.
--
-- Run in Supabase SQL editor after 018.

alter table public.notes
  add column if not exists external_id text;

create unique index if not exists notes_external_id_uniq
  on public.notes (external_id)
  where external_id is not null;

alter table public.attachments
  add column if not exists external_id text;

create unique index if not exists attachments_external_id_uniq
  on public.attachments (external_id)
  where external_id is not null;

-- Jobber client id → clients.jobber_id already exists on the base schema
-- but was never indexed. Add it so the API importer's "match by jobber_id
-- first, then fall back to name" lookup stays fast.
create unique index if not exists clients_jobber_id_uniq
  on public.clients (jobber_id)
  where jobber_id is not null;
