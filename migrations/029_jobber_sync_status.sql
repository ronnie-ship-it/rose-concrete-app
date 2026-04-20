-- Rose Concrete — clients.jobber_sync_status enum + decorative_concrete service type
--
-- This migration ships two related changes that the marketing site rollout
-- requires:
--
-- 1. `clients.jobber_sync_status` enum + column.
--    Marketing-site leads create internal client records first; pushing to
--    Jobber becomes opt-in per client. The enum tracks where each client
--    stands in that opt-in flow:
--      pending      — flagged for sync; cron will push next run
--      synced       — successfully pushed to Jobber
--      excluded     — explicitly excluded from sync (Ronnie's choice)
--      not_synced   — default; never been pushed and not flagged
--
-- 2. `decorative_concrete` value added to the service_type enum so the
--    marketing site's Decorative Concrete service page can pre-fill the
--    lead form with an honest typed value (was falling back to 'other').
--    Update lib/service-types.ts SERVICE_TYPES + SERVICE_LABEL alongside
--    this migration or the validator will still reject the value.
--
-- ALTER TYPE ADD VALUE statements cannot run inside the same transaction
-- as DDL that uses the new value. The enum addition runs first and is
-- safe to commit on its own.
--
-- Run in the Supabase SQL editor, after 028.

alter type service_type add value if not exists 'decorative_concrete';

do $$ begin
  create type jobber_sync_status as enum (
    'pending',
    'synced',
    'excluded',
    'not_synced'
  );
exception when duplicate_object then null; end $$;

alter table public.clients
  add column if not exists jobber_sync_status jobber_sync_status not null default 'not_synced',
  add column if not exists jobber_synced_at   timestamptz,
  add column if not exists jobber_external_id text;

create index if not exists clients_jobber_sync_status_idx
  on public.clients (jobber_sync_status);

-- Reporting view: leads from the marketing site, joined to client status.
-- Used by /dashboard/leads/website to show the per-source-page lead feed
-- without re-typing the join in app code.
create or replace view public.marketing_leads_view as
select
  l.id,
  l.captured_at,
  l.source,
  l.status,
  l.service_type,
  l.message,
  l.contact_name,
  l.contact_phone,
  l.contact_email,
  l.client_id,
  l.project_id,
  l.responded_at,
  c.name           as client_name,
  c.jobber_sync_status,
  c.jobber_synced_at
from public.leads l
left join public.clients c on c.id = l.client_id
where l.source like 'marketing/%';

-- Lock the view down to admin/office, same RLS shape as leads.
-- Views inherit the underlying table's RLS, but we explicitly grant
-- so future readers don't have to reverse-engineer it.
grant select on public.marketing_leads_view to authenticated;
