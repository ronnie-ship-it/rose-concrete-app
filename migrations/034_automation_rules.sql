-- Rose Concrete — Automations rules engine
--
-- Jobber-style rules: each rule has a trigger, optional filter, and a
-- list of actions. Rules fire when `runAutomationsFor(trigger, entity)`
-- is called from the server action where the business event happens
-- (quote approved → calls it, job complete → calls it, etc.).
--
-- The existing `automation_config` / `automation_runs` tables (migration
-- 021) power the cron-based follow-up cadence. This new layer is the
-- user-configurable one — Ronnie can turn rules on/off, tweak the copy,
-- add brand-new flows without a deploy.

do $$ begin
  create type automation_trigger as enum (
    'quote_approved',
    'quote_sent',
    'job_completed',
    'invoice_paid',
    'visit_scheduled',
    'visit_completed',
    'lead_captured'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_action_kind as enum (
    'send_sms',
    'send_email',
    'create_task',
    'move_status',
    'notify_office'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.automation_rules (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text,
  trigger      automation_trigger not null,
  is_enabled   boolean not null default true,
  -- Optional filter conditions — simple key/value matcher against the
  -- entity payload the trigger dispatches with. Empty = fire for every
  -- event. Example: `{"service_type": "sidewalk"}` makes the rule
  -- only fire on sidewalk projects.
  conditions   jsonb not null default '{}'::jsonb,
  -- Ordered list of actions to run in sequence. Each action is
  -- `{ kind: 'send_sms'|'send_email'|'create_task'|'move_status'|'notify_office',
  --    ...kind-specific fields }`. See lib/automations.ts for shape.
  actions      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists automation_rules_trigger_idx
  on public.automation_rules (trigger)
  where is_enabled = true;

create trigger automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function set_updated_at();

alter table public.automation_rules enable row level security;
do $$ begin
  create policy "admin manage automation_rules"
    on public.automation_rules for all using (public.is_admin())
    with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated reads automation_rules"
    on public.automation_rules for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- Per-rule execution history for auditing + debugging. The automation
-- dispatcher writes one row per fire so Ronnie can see what happened.
create table if not exists public.automation_rule_runs (
  id           uuid primary key default uuid_generate_v4(),
  rule_id      uuid not null references public.automation_rules(id) on delete cascade,
  trigger      automation_trigger not null,
  entity_type  text not null,
  entity_id    uuid not null,
  status       text not null default 'ok',      -- 'ok' | 'skipped' | 'error'
  summary      text,
  actions_run  jsonb not null default '[]'::jsonb,
  ran_at       timestamptz not null default now()
);
create index if not exists automation_rule_runs_rule_idx
  on public.automation_rule_runs (rule_id, ran_at desc);
create index if not exists automation_rule_runs_entity_idx
  on public.automation_rule_runs (entity_type, entity_id, ran_at desc);

alter table public.automation_rule_runs enable row level security;
do $$ begin
  create policy "admin office read automation_rule_runs"
    on public.automation_rule_runs for select using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service role writes automation_rule_runs"
    on public.automation_rule_runs for insert with check (true);
exception when duplicate_object then null; end $$;

-- Seed a few sensible defaults so the engine is useful the moment
-- migration 034 lands.
insert into public.automation_rules (name, description, trigger, actions)
select * from (values
  (
    'Text customer when quote approved',
    'Auto-SMS "thanks for approving" with the project name.',
    'quote_approved'::automation_trigger,
    $$[{"kind":"send_sms","body":"Hi {first_name} — thanks for approving {project_name}! We'll text you with scheduling details shortly. — Ronnie"}]$$::jsonb
  ),
  (
    'Notify office on new lead',
    'In-app notification to every admin/office user when a new lead comes in.',
    'lead_captured'::automation_trigger,
    $$[{"kind":"notify_office","title":"New lead: {client_name}","body":"{service_type} at {service_address}"}]$$::jsonb
  ),
  (
    'Review request when job completes',
    'Create a follow-up task for Ronnie to send a Google review request 3 days after job completion.',
    'job_completed'::automation_trigger,
    $$[{"kind":"create_task","title":"Ask {client_name} for a Google review","due_offset_days":3,"priority":"normal"}]$$::jsonb
  )
) as v(name, description, trigger, actions)
where not exists (select 1 from public.automation_rules);
