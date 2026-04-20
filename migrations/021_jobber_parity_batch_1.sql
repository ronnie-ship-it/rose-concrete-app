-- Rose Concrete — Jobber-parity batch 1 (overnight 2026-04-16)
--
-- One migration covering every schema change needed for the features
-- shipped in the overnight batch. Additive/idempotent — safe to rerun.
--
-- Sections (Ctrl-F to navigate):
--   1. Client Hub (login tokens)
--   2. Notifications (in-app)
--   3. Recurring jobs
--   4. Multi-property clients
--   5. Discount codes
--   6. Tax rates
--   7. Custom fields
--   8. Job forms / checklists
--   9. Communications: unread tracking
--  10. Referral tracking on leads
--  11. Dashboard widget prefs
--  12. Invoice schedule rules
--  13. Automation cadence config
--  14. Crew permissions

-- ===== 1. Client Hub =====
-- Public login tokens so a client can hit a link from their email and
-- see their quotes, invoices, job history, send messages, upload files
-- — without creating an auth.users row. Token is cryptographically
-- random; rotating invalidates every old link.
alter table public.clients
  add column if not exists hub_token text unique default encode(gen_random_bytes(16), 'hex'),
  add column if not exists hub_token_rotated_at timestamptz not null default now();

-- ===== 2. Notifications =====
do $$ begin
  create type notification_kind as enum (
    'new_lead',
    'quote_approved',
    'invoice_paid',
    'job_completed',
    'new_message',
    'overdue_task',
    'quote_follow_up',
    'review_received',
    'system'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         notification_kind not null,
  title        text not null,
  body         text,
  link         text,                              -- in-app URL to open
  entity_type  text,                              -- 'client', 'project', ...
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index if not exists notifications_user_all_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
do $$ begin
  create policy "users read own notifications" on public.notifications
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users mark own notifications" on public.notifications
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin office full access notifications" on public.notifications
    for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;

-- ===== 3. Recurring jobs =====
-- Simple human-readable cadence + next_visit_at. When a visit for a
-- recurring project is marked completed, the cron creates the next one.
do $$ begin
  create type recurrence_cadence as enum (
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'yearly',
    'custom'
  );
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists recurrence_cadence recurrence_cadence,
  add column if not exists recurrence_interval_days int,
  add column if not exists recurrence_next_at timestamptz,
  add column if not exists recurrence_end_at timestamptz;

create index if not exists projects_recurrence_next_idx
  on public.projects (recurrence_next_at)
  where recurrence_cadence is not null;

-- ===== 4. Multi-property clients =====
-- One client → many serviced properties. Projects can reference the
-- property they're scoped to. Legacy projects with just a
-- service_address keep working.
create table if not exists public.client_properties (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  label        text not null,                     -- "Main house", "Store 3"
  address      text,
  city         text,
  state        text default 'CA',
  postal_code  text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_properties_client_idx
  on public.client_properties (client_id);
create trigger client_properties_updated_at
  before update on public.client_properties
  for each row execute function set_updated_at();

alter table public.client_properties enable row level security;
do $$ begin
  create policy "admin office full access client_properties"
    on public.client_properties for all
    using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads client_properties"
    on public.client_properties for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists property_id uuid references public.client_properties(id) on delete set null;

-- ===== 5. Discount codes =====
create table if not exists public.discount_codes (
  id                uuid primary key default uuid_generate_v4(),
  code              text not null unique,
  label             text,
  percent_off       numeric(5, 2),      -- 0-100
  amount_off        numeric(12, 2),     -- fixed dollar discount
  starts_at         timestamptz,
  ends_at           timestamptz,
  max_uses          int,
  uses              int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists discount_codes_active_idx
  on public.discount_codes (is_active, code);

alter table public.discount_codes enable row level security;
do $$ begin
  create policy "admin office full access discount_codes"
    on public.discount_codes for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;

alter table public.quotes
  add column if not exists discount_code_id uuid references public.discount_codes(id),
  add column if not exists discount_amount numeric(12, 2) not null default 0;

-- ===== 6. Tax rates =====
create table if not exists public.tax_rates (
  id              uuid primary key default uuid_generate_v4(),
  label           text not null,                    -- "San Diego County"
  rate_percent    numeric(6, 3) not null,           -- e.g. 7.750
  applies_to      text,                             -- service_type or null=all
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.tax_rates enable row level security;
do $$ begin
  create policy "admin office full access tax_rates"
    on public.tax_rates for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads tax_rates"
    on public.tax_rates for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

alter table public.quotes
  add column if not exists tax_rate_id uuid references public.tax_rates(id),
  add column if not exists tax_amount numeric(12, 2) not null default 0;

-- ===== 7. Custom fields =====
do $$ begin
  create type custom_field_entity as enum ('client', 'project', 'quote');
exception when duplicate_object then null; end $$;
do $$ begin
  create type custom_field_type as enum ('text', 'number', 'date', 'boolean', 'select');
exception when duplicate_object then null; end $$;

create table if not exists public.custom_field_definitions (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  custom_field_entity not null,
  key          text not null,                      -- snake_case, unique per entity_type
  label        text not null,
  field_type   custom_field_type not null,
  options      jsonb,                              -- for type=select
  position     int not null default 0,
  is_required  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (entity_type, key)
);

alter table public.custom_field_definitions enable row level security;
do $$ begin
  create policy "admin manage custom_field_definitions"
    on public.custom_field_definitions for all using (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads custom_field_definitions"
    on public.custom_field_definitions for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

create table if not exists public.custom_field_values (
  id            uuid primary key default uuid_generate_v4(),
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  entity_type   custom_field_entity not null,
  entity_id     uuid not null,
  value_text    text,
  value_number  numeric,
  value_date    date,
  value_bool    boolean,
  updated_at    timestamptz not null default now(),
  unique (definition_id, entity_id)
);
create index if not exists custom_field_values_entity_idx
  on public.custom_field_values (entity_type, entity_id);

alter table public.custom_field_values enable row level security;
do $$ begin
  create policy "admin office full access custom_field_values"
    on public.custom_field_values for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;

-- ===== 8. Job forms / checklists =====
do $$ begin
  create type job_form_kind as enum (
    'pre_inspection',
    'safety',
    'completion',
    'custom'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type job_form_status as enum ('pending', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

-- A template is a kind + list of checklist items (jsonb, easy to edit).
-- Each item: { key, label, type ("check"|"text"|"photo"), required? }
create table if not exists public.job_form_templates (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  kind          job_form_kind not null,
  service_type  service_type,                       -- null = all service types
  items         jsonb not null,
  is_required_to_complete boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.job_form_templates enable row level security;
do $$ begin
  create policy "admin manage job_form_templates"
    on public.job_form_templates for all using (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads job_form_templates"
    on public.job_form_templates for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- An instance is one template attached to one project (or one visit).
-- `responses` jsonb keys match the template's item keys.
create table if not exists public.job_form_instances (
  id            uuid primary key default uuid_generate_v4(),
  template_id   uuid not null references public.job_form_templates(id) on delete restrict,
  project_id    uuid references public.projects(id) on delete cascade,
  visit_id      uuid references public.visits(id) on delete cascade,
  status        job_form_status not null default 'pending',
  responses     jsonb not null default '{}'::jsonb,
  completed_by  uuid references public.profiles(id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists job_form_instances_project_idx
  on public.job_form_instances (project_id);
create index if not exists job_form_instances_visit_idx
  on public.job_form_instances (visit_id);
create trigger job_form_instances_updated_at
  before update on public.job_form_instances
  for each row execute function set_updated_at();

alter table public.job_form_instances enable row level security;
do $$ begin
  create policy "admin office full access job_form_instances"
    on public.job_form_instances for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crew reads assigned job_form_instances"
    on public.job_form_instances for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crew updates job_form_instances"
    on public.job_form_instances for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- ===== 9. Communications: unread tracking =====
alter table public.communications
  add column if not exists read_at timestamptz;
create index if not exists communications_unread_idx
  on public.communications (client_id, started_at desc)
  where read_at is null and direction = 'inbound';

-- ===== 10. Referral tracking on leads =====
alter table public.leads
  add column if not exists referred_by_client_id uuid references public.clients(id) on delete set null;
alter table public.clients
  add column if not exists referred_by_client_id uuid references public.clients(id) on delete set null;
create index if not exists clients_referred_by_idx
  on public.clients (referred_by_client_id);

-- ===== 11. Dashboard widget preferences =====
-- Each user picks which widgets to show + their order. No widgets table —
-- widget availability is hard-coded in app code; this row just stores
-- the user's layout.
create table if not exists public.dashboard_prefs (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  widgets     text[] not null default '{"today_jobs","unpaid_invoices","open_quotes","recent_messages","revenue_chart","lead_pipeline"}',
  updated_at  timestamptz not null default now()
);
alter table public.dashboard_prefs enable row level security;
do $$ begin
  create policy "users manage own dashboard_prefs"
    on public.dashboard_prefs for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ===== 12. Invoice schedule rules =====
-- Projects/quotes can auto-send invoices on a trigger (visit_complete,
-- project_close, specific_date). Minimal — extend later.
do $$ begin
  create type invoice_schedule_trigger as enum (
    'visit_complete',
    'project_close',
    'specific_date',
    'manual'
  );
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists invoice_trigger invoice_schedule_trigger not null default 'manual',
  add column if not exists invoice_scheduled_for timestamptz,
  add column if not exists invoice_sent_at timestamptz;

-- ===== 13. Automation cadence config =====
-- Per-stage offsets (in days) for the quote follow-up and post-job
-- follow-up crons. Single row of config Ronnie can tweak at
-- /dashboard/settings/automations.
create table if not exists public.automation_config (
  id                         uuid primary key default uuid_generate_v4(),
  quote_followup_first_days  int not null default 3,
  quote_followup_second_days int not null default 7,
  quote_cold_after_days      int not null default 14,
  postjob_thankyou_days      int not null default 0,
  postjob_review_days        int not null default 3,
  postjob_checkin_days       int not null default 30,
  review_url                 text,
  updated_at                 timestamptz not null default now()
);
insert into public.automation_config (id)
  select '00000000-0000-0000-0000-000000000001'::uuid
  where not exists (select 1 from public.automation_config);

alter table public.automation_config enable row level security;
do $$ begin
  create policy "admin manage automation_config"
    on public.automation_config for all using (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads automation_config"
    on public.automation_config for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- Tracking table for sent follow-ups so cron is idempotent.
do $$ begin
  create type automation_stage as enum (
    'quote_followup_1',
    'quote_followup_2',
    'quote_cold',
    'postjob_thankyou',
    'postjob_review',
    'postjob_checkin'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.automation_runs (
  id          uuid primary key default uuid_generate_v4(),
  stage       automation_stage not null,
  entity_type text not null,                -- 'quote' or 'project'
  entity_id   uuid not null,
  sent_at     timestamptz not null default now(),
  channel     text,                         -- 'sms' | 'email'
  status      text not null default 'sent', -- 'sent' | 'skipped' | 'failed'
  error       text,
  unique (stage, entity_type, entity_id)
);
create index if not exists automation_runs_entity_idx
  on public.automation_runs (entity_type, entity_id);

alter table public.automation_runs enable row level security;
do $$ begin
  create policy "admin office full access automation_runs"
    on public.automation_runs for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;

-- ===== 14. Crew permissions =====
-- Simple jsonb bag of boolean flags on profiles. Admins edit at
-- /dashboard/settings/team. Null means defaults (based on role).
alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;
