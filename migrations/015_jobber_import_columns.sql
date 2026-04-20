-- Rose Concrete — extra columns needed for the Jobber CSV import.
--
-- Everything here is additive / idempotent. Safe to run multiple times.

-- Clients: lead source (from Jobber "Lead source" column) + tag array.
alter table public.clients
  add column if not exists lead_source text,
  add column if not exists tags        text[] default '{}';

-- Projects: Jobber-native Job #, scheduled start, completion, service
-- address (distinct from client billing address).
alter table public.projects
  add column if not exists external_id       text,
  add column if not exists scheduled_start   timestamptz,
  add column if not exists completed_at      timestamptz,
  add column if not exists service_address   text;

create unique index if not exists projects_external_id_uniq
  on public.projects (external_id)
  where external_id is not null;

-- Quotes: optional human-readable title (Jobber's quote "Title" column)
-- and explicit approved_at (separate from accepted_at on the app side).
alter table public.quotes
  add column if not exists title         text,
  add column if not exists approved_at   timestamptz;

-- Visits: scheduled_date + scheduled_time convenience columns so we can
-- round-trip Jobber CSVs without losing precision on the time component.
alter table public.visits
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time;
