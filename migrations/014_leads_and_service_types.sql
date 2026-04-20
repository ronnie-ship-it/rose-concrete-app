-- Rose Concrete — lead-capture webhook support
--
-- Adds:
--   * projects.service_type (enum) — feeds reports + template matching
--   * leads.service_type / leads.message / leads.project_id / leads.quote_id
--   * a `lead_webhook` feature flag row
--   * the `review_requests` table that the review-request cron will read
--     (defined here so migrations 014+ all ship together in one wake-up pass).
--
-- Run in Supabase SQL editor, after 013.

do $$ begin
  create type service_type as enum (
    'driveway',
    'stamped_driveway',
    'patio',
    'sidewalk',
    'rv_pad',
    'pickleball_court',
    'repair',
    'other'
  );
exception when duplicate_object then null; end $$;

alter table public.projects
  add column if not exists service_type service_type;

alter table public.leads
  add column if not exists service_type service_type,
  add column if not exists message       text,
  add column if not exists project_id    uuid references public.projects(id) on delete set null,
  add column if not exists quote_id      uuid references public.quotes(id)   on delete set null,
  add column if not exists responded_at  timestamptz;

create index if not exists leads_project_idx on public.leads (project_id);

-- Review requests queue (seeds fire 3d after a milestone flips paid+receipted).
do $$ begin
  create type review_request_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;
do $$ begin
  create type review_request_status as enum ('pending','sent','skipped','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.review_requests (
  id            uuid primary key default uuid_generate_v4(),
  milestone_id  uuid unique references public.payment_milestones(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  channel       review_request_channel not null default 'email',
  status        review_request_status  not null default 'pending',
  send_after    timestamptz not null,
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists review_requests_due_idx
  on public.review_requests (status, send_after);

alter table public.review_requests enable row level security;
create policy "admin office full access review requests"
  on public.review_requests for all using (public.is_office_or_admin());

-- Visit reminders — audit of every 24h/1h nudge sent for a scheduled visit.
-- Unique on (visit_id, offset_hours, channel) so the cron is idempotent.
do $$ begin
  create type visit_reminder_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;
do $$ begin
  create type visit_reminder_status as enum ('sent','skipped','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.visit_reminders (
  id            uuid primary key default uuid_generate_v4(),
  visit_id      uuid not null references public.visits(id) on delete cascade,
  offset_hours  int not null,                       -- -24 or -1
  channel       visit_reminder_channel not null,
  status        visit_reminder_status not null,
  error         text,
  sent_at       timestamptz not null default now(),
  unique (visit_id, offset_hours, channel)
);

alter table public.visit_reminders enable row level security;
create policy "admin office full access visit reminders"
  on public.visit_reminders for all using (public.is_office_or_admin());

-- Clock-in / clock-out with GPS (crew mobile).
create table if not exists public.visit_time_entries (
  id              uuid primary key default uuid_generate_v4(),
  visit_id        uuid not null references public.visits(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  clock_in_at     timestamptz not null default now(),
  clock_in_lat    numeric(9,6),
  clock_in_lng    numeric(9,6),
  clock_out_at    timestamptz,
  clock_out_lat   numeric(9,6),
  clock_out_lng   numeric(9,6)
);
create index if not exists visit_time_entries_visit_idx
  on public.visit_time_entries (visit_id);
create index if not exists visit_time_entries_user_idx
  on public.visit_time_entries (user_id, clock_in_at desc);

alter table public.visit_time_entries enable row level security;
create policy "admin office full access time entries"
  on public.visit_time_entries for all using (public.is_office_or_admin());
create policy "crew manage own time entries"
  on public.visit_time_entries for all using (auth.uid() = user_id);

-- Feature flags for the night-build features.
insert into public.feature_flags (key, enabled) values
  ('lead_webhook',             false),
  ('review_request_auto_send', false),
  ('visit_reminders',          false),
  ('docusign_auto_send_on_accept', false)
on conflict (key) do nothing;
