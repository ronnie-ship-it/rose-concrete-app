-- Rose Concrete — extra Jobber CSV imports
--
-- Adds storage for the four additional exports Ronnie is pulling out of
-- Jobber: secondary client contacts, email history, request (lead) reports,
-- and customer feedback scores. Everything here is additive and idempotent
-- so safe to rerun.
--
-- Run in Supabase SQL editor after 017.

-- ----- Secondary contacts on a client -----
-- Jobber lets a client have extra people attached (spouse, property
-- manager, billing contact). Those come out of the `Client_Contact_Info`
-- export. Keeping them in their own table so the clients.name / .phone /
-- .email columns stay canonical for the primary contact.
create table if not exists public.client_contacts (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  contact_type text,            -- e.g. "billing", "property manager", "spouse"
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists client_contacts_client_idx
  on public.client_contacts (client_id);

alter table public.client_contacts enable row level security;
do $$ begin
  create policy "admin office full access client_contacts"
    on public.client_contacts for all
    using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads client_contacts"
    on public.client_contacts for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- ----- Email channel on communications -----
-- The communications table was built for call + SMS; Jobber's
-- `Client_Communications` export is mostly email logs. Extend the enum
-- and add email-specific columns.
--
-- NOTE: `alter type add value` cannot run inside a transaction block
-- before Postgres 12. Supabase (PG 15+) is fine here, but to be safe if
-- the SQL editor wraps the whole file in a transaction, paste this one
-- statement separately first if you hit an error.
alter type comm_channel add value if not exists 'email';

alter table public.communications
  add column if not exists subject       text,
  add column if not exists email_address text,
  add column if not exists thread_id     text;

-- ----- Feedback scores -----
-- Jobber's feedback / NPS export. One row per response, optionally tied
-- to a project if the request was about a specific job.
create table if not exists public.client_feedback (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid references public.clients(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  score        int,                -- 0-10 NPS or 1-5 stars, depends on score_type
  score_type   text,               -- 'nps' | 'rating' | 'csat'
  comment      text,
  feedback_at  timestamptz,
  external_id  text unique,        -- Jobber's feedback id when provided
  created_at   timestamptz not null default now()
);
create index if not exists client_feedback_client_idx
  on public.client_feedback (client_id);
create index if not exists client_feedback_project_idx
  on public.client_feedback (project_id);

alter table public.client_feedback enable row level security;
do $$ begin
  create policy "admin office full access client_feedback"
    on public.client_feedback for all
    using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads client_feedback"
    on public.client_feedback for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- ----- Lead report columns -----
-- The `Requests_Report` export carries more context than the webhook-seeded
-- leads have. Add optional columns so we can round-trip Jobber's export.
alter table public.leads
  add column if not exists external_id      text,
  add column if not exists title            text,
  add column if not exists contact_name     text,
  add column if not exists contact_phone    text,
  add column if not exists contact_email    text,
  add column if not exists service_address  text,
  add column if not exists requested_on     timestamptz,
  add column if not exists requested_price  numeric(12, 2);

create unique index if not exists leads_external_id_uniq
  on public.leads (external_id)
  where external_id is not null;
