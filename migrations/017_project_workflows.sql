-- Rose Concrete — Multi-step project workflows
--
-- Ronnie's city-sidewalk permit flow is the forcing function for this
-- feature. Every sidewalk-permit project runs the same 11-step ladder:
-- customer agreement → paperwork → city submission → survey routing →
-- completed paperwork → approval → schedule → work → final paperwork →
-- closeout. Tagging a project `service_type = 'sidewalk'` auto-seeds all
-- 11 steps, each with its own dependency, responsible role, and SLA.
--
-- Dependencies are soft: we store `depends_on_sequence`, and the UI
-- refuses to flip a step to `in_progress`/`done` until the predecessor
-- is `done` or `skipped`. That keeps the model flexible if Ronnie ever
-- needs to skip or reorder on an oddball job — nothing hard-blocks at
-- the DB level, the business rule is in the server action.
--
-- Staleness: if `in_progress_since` is older than 3 business days and
-- status is still `pending` or `in_progress`, the step is "stale". The
-- staleness cron reads this directly — no extra `stale_at` column.
--
-- Run after 016.

create table if not exists public.workflow_templates (
  id             uuid primary key default uuid_generate_v4(),
  service_type   service_type not null unique,
  name           text not null,
  steps          jsonb not null,
  -- each step: {title, description?, responsible_role?, sla_business_days?,
  --            depends_on_sequence?}
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger workflow_templates_updated_at
  before update on public.workflow_templates
  for each row execute function set_updated_at();

alter table public.workflow_templates enable row level security;
create policy "admin office full access workflow_templates"
  on public.workflow_templates
  for all using (public.is_office_or_admin());
create policy "authenticated reads workflow_templates"
  on public.workflow_templates
  for select using (auth.uid() is not null);

create table if not exists public.project_workflow_steps (
  id                   uuid primary key default uuid_generate_v4(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  sequence             integer not null,
  title                text not null,
  description          text,
  responsible_role     text,         -- free text: "office", "crew", "admin", "city", "customer"
  assigned_to          uuid references public.profiles(id) on delete set null,
  status               text not null default 'pending'
                         check (status in ('pending','in_progress','done','skipped')),
  depends_on_sequence  integer,
  due_date             date,
  sla_business_days    integer,      -- seeds due_date when the step opens
  in_progress_since    timestamptz,  -- set when status first goes in_progress
  completed_at         timestamptz,
  completed_by         uuid references public.profiles(id) on delete set null,
  -- Per-step log payload. Typical contents: submission_date,
  -- permit_number, survey_sent_at, inspection_at. Free-form so the UI
  -- can grow without a migration per field.
  metadata             jsonb not null default '{}'::jsonb,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (project_id, sequence)
);
create trigger project_workflow_steps_updated_at
  before update on public.project_workflow_steps
  for each row execute function set_updated_at();
create index if not exists project_workflow_steps_project_idx
  on public.project_workflow_steps (project_id, sequence);
create index if not exists project_workflow_steps_status_idx
  on public.project_workflow_steps (status, in_progress_since)
  where status in ('pending','in_progress');

alter table public.project_workflow_steps enable row level security;
create policy "admin office full access workflow_steps"
  on public.project_workflow_steps
  for all using (public.is_office_or_admin());
create policy "authenticated reads workflow_steps"
  on public.project_workflow_steps
  for select using (auth.uid() is not null);

-- Staleness-reminder ledger so the cron is idempotent.
create table if not exists public.workflow_stale_reminders (
  id              uuid primary key default uuid_generate_v4(),
  step_id         uuid not null references public.project_workflow_steps(id) on delete cascade,
  sent_at         timestamptz not null default now(),
  business_days   integer not null,
  channel         text not null default 'dashboard',
  unique (step_id, business_days)
);
alter table public.workflow_stale_reminders enable row level security;
create policy "admin office full access workflow_stale_reminders"
  on public.workflow_stale_reminders
  for all using (public.is_office_or_admin());
create policy "authenticated reads workflow_stale_reminders"
  on public.workflow_stale_reminders
  for select using (auth.uid() is not null);

-- Seed Ronnie's exact 11-step sidewalk-permit process.
insert into public.workflow_templates (service_type, name, steps)
values (
  'sidewalk',
  'City sidewalk permit job',
  '[
    {"title": "Customer agreement", "description": "Customer agrees to sidewalk repair. Confirm scope + address, create project in app.", "responsible_role": "office", "sla_business_days": 2},
    {"title": "Receive customer paperwork", "description": "Customer emails paperwork. Download, attach to project, mark received.", "responsible_role": "office", "sla_business_days": 3, "depends_on_sequence": 1},
    {"title": "Submit to city", "description": "Forward paperwork to city contact. Log submission date, attach sent email.", "responsible_role": "office", "sla_business_days": 2, "depends_on_sequence": 2},
    {"title": "Forward survey request", "description": "City requires survey. Forward paperwork to survey company, log date sent.", "responsible_role": "office", "sla_business_days": 2, "depends_on_sequence": 3},
    {"title": "Wait for survey return", "description": "Follow up with survey company if not received within 5 business days.", "responsible_role": "office", "sla_business_days": 5, "depends_on_sequence": 4},
    {"title": "Submit completed paperwork to city", "description": "Send completed survey back to city, log submission date.", "responsible_role": "office", "sla_business_days": 2, "depends_on_sequence": 5},
    {"title": "Receive city approval", "description": "Log permit number, permit approval date, expiration date.", "responsible_role": "city", "sla_business_days": 10, "depends_on_sequence": 6},
    {"title": "Schedule demo and repair", "description": "Schedule crew on calendar, order materials.", "responsible_role": "office", "sla_business_days": 3, "depends_on_sequence": 7},
    {"title": "Complete the work", "description": "Crew marks job complete, photos required, upload to project.", "responsible_role": "crew", "sla_business_days": 5, "depends_on_sequence": 8},
    {"title": "Send final paperwork to city", "description": "Submit completion paperwork, log submission date.", "responsible_role": "office", "sla_business_days": 2, "depends_on_sequence": 9},
    {"title": "City closes out", "description": "Confirm closeout, mark project complete.", "responsible_role": "city", "sla_business_days": 10, "depends_on_sequence": 10}
  ]'::jsonb
)
on conflict (service_type) do nothing;

insert into public.feature_flags (key, enabled)
values ('project_workflows', true)
on conflict (key) do nothing;
