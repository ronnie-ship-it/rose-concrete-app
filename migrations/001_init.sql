-- Rose Concrete — initial schema
-- Phase 1 core tables. Every module-specific concern is gated by feature_flags.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- ===== Extensions =====
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ===== Helpers =====
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ===== Users =====
-- Supabase Auth creates rows in auth.users automatically.
-- We add a profile row mirroring the id with a role.
create type user_role as enum ('admin', 'office', 'crew');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'crew',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();

-- ===== Clients =====
create table public.clients (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text default 'CA',
  postal_code text,
  source      text, -- web, poptin, thumbtack, referral, phone, walk_in, etc.
  jobber_id   text, -- migration trace back to legacy Jobber ID
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index clients_name_idx on public.clients using gin (to_tsvector('simple', name));
create index clients_phone_idx on public.clients (phone);
create index clients_email_idx on public.clients (email);
create trigger clients_updated_at before update on public.clients
  for each row execute function set_updated_at();

-- ===== Projects =====
create type project_status as enum (
  'lead', 'quoting', 'approved', 'scheduled', 'active', 'done', 'cancelled'
);

create table public.projects (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  name                text not null,
  location            text,
  status              project_status not null default 'lead',
  sqft                numeric(10, 2),
  cubic_yards         numeric(10, 2),
  measurement_source  text, -- 'moasure', 'manual', 'tape', 'plans'
  measurement_notes   text,
  revenue_cached      numeric(12, 2) default 0,
  cost_cached         numeric(12, 2) default 0,
  margin_cached       numeric(12, 2) default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);
create trigger projects_updated_at before update on public.projects
  for each row execute function set_updated_at();

-- ===== Photos library (Supabase Storage references) =====
create table public.photos (
  id              uuid primary key default uuid_generate_v4(),
  storage_key     text not null,        -- path in the `photos` storage bucket
  thumbnail_key   text,
  tags            text[] default '{}',
  project_id      uuid references public.projects(id) on delete set null, -- null = library photo
  caption         text,
  taken_at        timestamptz,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index photos_project_idx on public.photos (project_id);
create index photos_tags_idx on public.photos using gin (tags);

-- ===== Quotes =====
create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type docusign_status as enum ('not_sent', 'sent', 'delivered', 'signed', 'voided', 'declined', 'error');

create table public.quotes (
  id                       uuid primary key default uuid_generate_v4(),
  project_id               uuid not null references public.projects(id) on delete cascade,
  number                   text not null unique, -- e.g., 2026-0408-01
  issued_at                date not null default current_date,
  valid_through            date not null default (current_date + interval '30 days'),
  scope_markdown           text not null default '',
  personal_note            text,

  deposit_amount           numeric(12, 2),
  deposit_percent          numeric(5, 2) default 50,
  deposit_nonrefundable    boolean not null default true,
  balance_terms            text default 'Balance due upon completion.',
  warranty_months          int not null default 36,
  estimated_duration_days  int,

  base_total               numeric(12, 2) not null default 0,
  optional_total           numeric(12, 2) not null default 0,
  accepted_total           numeric(12, 2),

  status                   quote_status not null default 'draft',
  public_token             text not null unique default encode(gen_random_bytes(16), 'hex'),

  accepted_at              timestamptz,
  accepted_signature       text,
  accepted_ip              inet,
  accepted_by_name         text,

  docusign_envelope_id     text,
  docusign_status          docusign_status not null default 'not_sent',

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index quotes_project_idx on public.quotes (project_id);
create index quotes_status_idx on public.quotes (status);
create index quotes_token_idx on public.quotes (public_token);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function set_updated_at();

-- ===== Quote line items =====
create table public.quote_line_items (
  id             uuid primary key default uuid_generate_v4(),
  quote_id       uuid not null references public.quotes(id) on delete cascade,
  position       int not null default 0,
  title          text not null,
  description    text,
  quantity       numeric(10, 2) not null default 1,
  unit           text default 'job', -- 'job', 'sqft', 'cu_yd', 'lf', 'hr'
  unit_price     numeric(12, 2) not null default 0,
  line_total     numeric(12, 2) generated always as (quantity * unit_price) stored,
  is_optional    boolean not null default false,
  is_selected    boolean not null default true,  -- default on; optional items start selected unless admin says otherwise
  photo_id       uuid references public.photos(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index quote_line_items_quote_idx on public.quote_line_items (quote_id);

-- ===== Visits (the calendar / schedule) =====
create type visit_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');

create table public.visits (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  scheduled_for    timestamptz not null,
  duration_min     int not null default 60,
  is_placeholder   boolean not null default false, -- OpenPhone intake tentative slot
  status           visit_status not null default 'scheduled',
  notes            text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index visits_project_idx on public.visits (project_id);
create index visits_scheduled_idx on public.visits (scheduled_for);
create trigger visits_updated_at before update on public.visits
  for each row execute function set_updated_at();

create table public.visit_assignments (
  visit_id   uuid not null references public.visits(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  primary key (visit_id, user_id)
);

-- ===== Leads (web / phone / thumbtack intake) =====
create type lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost');

create table public.leads (
  id           uuid primary key default uuid_generate_v4(),
  source       text not null, -- 'poptin', 'thumbtack', 'phone', 'web', 'walk_in'
  raw_payload  jsonb not null default '{}'::jsonb,
  client_id    uuid references public.clients(id) on delete set null,
  status       lead_status not null default 'new',
  captured_at  timestamptz not null default now(),
  notes        text
);
create index leads_source_idx on public.leads (source);
create index leads_status_idx on public.leads (status);

-- ===== Job costs (mirrored from QuickBooks) =====
create table public.job_costs (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid references public.projects(id) on delete set null,
  qbo_transaction_id text unique,
  category          text,
  amount            numeric(12, 2) not null,
  occurred_on       date not null,
  memo              text,
  synced_at         timestamptz not null default now()
);
create index job_costs_project_idx on public.job_costs (project_id);

-- ===== Marketing metrics (daily snapshots) =====
create table public.marketing_metrics (
  id          uuid primary key default uuid_generate_v4(),
  date        date not null,
  channel     text not null, -- 'semrush', 'google_ads', 'meta_ads', 'thumbtack', 'poptin'
  metric_name text not null, -- 'organic_traffic', 'spend', 'conversions', 'cpl', 'impressions'
  value       numeric(14, 4) not null,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (date, channel, metric_name)
);
create index marketing_metrics_date_idx on public.marketing_metrics (date desc);

-- ===== Activity log =====
create table public.activity_log (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  text not null, -- 'client', 'project', 'quote', 'visit', 'lead'
  entity_id    uuid not null,
  action       text not null, -- 'created', 'updated', 'quote_sent', 'quote_accepted', etc.
  actor_id     uuid references public.profiles(id) on delete set null,
  payload      jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- ===== Feature flags (the modularity layer) =====
create table public.feature_flags (
  key      text primary key,
  enabled  boolean not null default false,
  config   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled) values
  ('quotes_optional_items',    true),
  ('docusign_auto_send',       false),  -- flip on after beta access + template wiring
  ('openphone_intake',         false),  -- flip on after Phase 1 port
  ('qbo_job_costing',          false),  -- Phase 2
  ('marketing_dashboard',      false),  -- Phase 2
  ('daily_email_digest',       false),  -- Phase 2
  ('social_post_drafter',      false),  -- Phase 2
  ('crew_mobile_view',         true),
  ('gdrive_photo_sync',        false),
  ('google_ads_autonomous',    false),  -- Phase 2.5
  ('google_ads_shadow_mode',   false),  -- Phase 2.5 precursor
  ('duda_monitor',             false),  -- Phase 2.5
  ('material_ordering',        false)   -- Phase 3
on conflict (key) do nothing;

-- ===== Row Level Security =====
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.photos            enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_line_items  enable row level security;
alter table public.visits            enable row level security;
alter table public.visit_assignments enable row level security;
alter table public.leads             enable row level security;
alter table public.job_costs         enable row level security;
alter table public.marketing_metrics enable row level security;
alter table public.activity_log      enable row level security;
alter table public.feature_flags     enable row level security;

-- Everyone authenticated can see their own profile; admin sees all.
create policy "own profile readable" on public.profiles
  for select using (auth.uid() = id);
create policy "admin reads all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Admin + office can do everything on business data; crew gets narrow read + write-photos.
create policy "admin office full access clients" on public.clients
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "admin office full access projects" on public.projects
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "crew reads assigned projects" on public.projects
  for select using (
    exists (
      select 1 from public.visits v
      join public.visit_assignments va on va.visit_id = v.id
      where v.project_id = projects.id and va.user_id = auth.uid()
    )
  );

create policy "admin office full access quotes" on public.quotes
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "admin office full access quote items" on public.quote_line_items
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "admin office full access visits" on public.visits
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "crew reads assigned visits" on public.visits
  for select using (
    exists (
      select 1 from public.visit_assignments va
      where va.visit_id = visits.id and va.user_id = auth.uid()
    )
  );
create policy "crew marks own visits done" on public.visits
  for update using (
    exists (
      select 1 from public.visit_assignments va
      where va.visit_id = visits.id and va.user_id = auth.uid()
    )
  );

create policy "anyone auth can upload photos" on public.photos
  for insert with check (auth.uid() is not null);
create policy "anyone auth reads photos" on public.photos
  for select using (auth.uid() is not null);

create policy "feature flags readable" on public.feature_flags
  for select using (auth.uid() is not null);
create policy "admin writes feature flags" on public.feature_flags
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Public quote access is handled via a server action that validates the public_token
-- server-side and returns data without relying on RLS (server uses the service role key).
