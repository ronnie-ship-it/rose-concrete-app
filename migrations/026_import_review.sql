-- Rose Concrete — Import review staging table
--
-- When a Jobber CSV row can't be matched (fuzzy matcher returned null,
-- ambiguous match, parent missing), we used to silently drop it and dump
-- a reason into the action's `reasons` array. That worked for small
-- imports but Ronnie lost the offending row — the only way to recover
-- was to re-upload the CSV after fixing the client list.
--
-- This table stages every "couldn't auto-match" row so the admin can
-- review at /dashboard/settings/import-review, pick the right parent
-- from the suggestion list, and commit. Idempotent by (kind, payload_hash)
-- so re-running the same import doesn't duplicate pending rows.

create table if not exists public.import_review_rows (
  id            uuid primary key default uuid_generate_v4(),
  kind          text not null,                 -- 'project' | 'quote' | 'visit' | 'contact' | ...
  row_number    int,                           -- CSV row number (1-indexed, incl. header)
  raw           jsonb not null,                -- raw CSV row as-is
  payload       jsonb not null,                -- mapped payload (ready to insert once fixed)
  reason        text not null,                 -- human-readable why it didn't auto-match
  suggestions   jsonb not null default '[]'::jsonb, -- [{id, name, reason, distance}]
  status        text not null default 'pending', -- 'pending' | 'resolved' | 'dismissed'
  resolved_entity_type text,                   -- 'client' | 'project'
  resolved_entity_id   uuid,
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  payload_hash  text,                          -- sha-like dedupe key
  created_at    timestamptz not null default now(),
  unique (kind, payload_hash)
);

create index if not exists import_review_status_idx
  on public.import_review_rows (status, kind, created_at desc);

alter table public.import_review_rows enable row level security;
create policy "admin office read import_review_rows"
  on public.import_review_rows for select using (public.is_office_or_admin());
create policy "admin write import_review_rows"
  on public.import_review_rows for all using (public.is_admin())
  with check (public.is_admin());
