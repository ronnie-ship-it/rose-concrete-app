-- 038_phases_forms_reminders.sql
--
-- Four-in-one migration for the "job lifecycle" batch:
--   1. project_phases            — demo → prep → pour → cleanup → inspection
--   2. project_crew_members      — maps users to phases (for reminders + texts)
--   3. customer_forms + responses — pre-demo ack, pre-pour inspection,
--      completion form — token-gated signed flows
--   4. crew_photo_reminders      — audit log for the daily 4pm cron
--
-- All additive. `on delete cascade` everywhere project_id points so
-- deleting a project cleans up its phase + form history.

-- ========================================================================
-- 1. Project phases
-- ========================================================================
do $$ begin
  create type project_phase_kind as enum (
    'demo',          -- site demo / tear-out
    'prep',          -- subgrade, forms, rebar
    'pour',          -- concrete delivery + pour
    'cleanup',       -- strip forms, haul debris
    'inspection',    -- walkthrough + customer sign-off
    'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_phase_status as enum (
    'pending',       -- phase exists, no dates yet
    'scheduled',     -- dates set, crew notified
    'in_progress',   -- phase started
    'done',          -- phase completed
    'skipped'        -- phase N/A for this project
  );
exception when duplicate_object then null; end $$;

create table if not exists public.project_phases (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  kind          project_phase_kind not null,
  label         text not null,                   -- shown on timeline
  sequence      int not null,                    -- render order
  start_date    date,
  end_date      date,
  status        project_phase_status not null default 'pending',
  notes         text,
  -- Draft SMS text for this phase. Populated by the phase-schedule
  -- server action; Ronnie reviews + taps send (never auto-sends).
  -- When sent, `text_sent_at` stamps, `text_draft_body` is kept as
  -- an audit of what went out.
  text_draft_body  text,
  text_draft_to    text,            -- comma-separated phone numbers
  text_sent_at     timestamptz,
  text_sent_by     uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists project_phases_project_idx
  on public.project_phases (project_id, sequence);
create index if not exists project_phases_date_idx
  on public.project_phases (start_date)
  where start_date is not null;
create trigger project_phases_updated_at
  before update on public.project_phases
  for each row execute function set_updated_at();

alter table public.project_phases enable row level security;
create policy "office reads project phases" on public.project_phases
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office', 'crew'))
  );
create policy "office writes project phases" on public.project_phases
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

-- ========================================================================
-- 2. project_crew_members — who's assigned to a project (for reminders)
-- ========================================================================
-- Not tied to phases — a crew member on the project gets the daily
-- 4pm photo reminder regardless of which phase is active.
create table if not exists public.project_crew_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_note   text,                              -- "lead", "op", "helper"
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_crew_members_user_idx
  on public.project_crew_members (user_id);

alter table public.project_crew_members enable row level security;
create policy "read project crew" on public.project_crew_members
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office', 'crew'))
  );
create policy "office writes project crew" on public.project_crew_members
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

-- ========================================================================
-- 3. customer_forms + customer_form_responses
-- ========================================================================
-- A `customer_form` is a token-gated page we email to the customer.
-- The three kinds map to the three flows:
--   - demo_ack        — pre-demo video + acknowledgment disclaimer
--   - pre_pour        — confirm mix / pattern / finish / color / notes
--   - completion      — confirm work complete + satisfactory, sign
--
-- One row per (project, kind) — re-sending the same kind reuses the
-- token so the customer's link doesn't change.
do $$ begin
  create type customer_form_kind as enum (
    'demo_ack', 'pre_pour', 'completion', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_form_status as enum (
    'draft',         -- not yet sent
    'sent',          -- emailed/texted, waiting on customer
    'completed',     -- customer submitted
    'expired'        -- optional: token rotated
  );
exception when duplicate_object then null; end $$;

create table if not exists public.customer_forms (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  kind          customer_form_kind not null,
  status        customer_form_status not null default 'draft',
  -- Cryptographic token that unlocks the public /forms/<token> page.
  token         text not null unique default encode(gen_random_bytes(16), 'hex'),
  -- Snapshot of what the customer sees: title, instruction copy,
  -- list of items to confirm. Stored as JSON so Ronnie can tweak
  -- the template without migrations.
  title         text not null,
  intro_markdown text,
  video_url     text,       -- only populated for demo_ack
  -- Items the customer must confirm/initial. Each item:
  --   { key: "mix_3500psi", label: "Mix design: 3500 PSI", required: true }
  items         jsonb not null default '[]'::jsonb,
  sent_at       timestamptz,
  sent_via      text,       -- 'email' | 'sms' | 'hub'
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, kind)
);
create index if not exists customer_forms_project_idx
  on public.customer_forms (project_id);
create index if not exists customer_forms_status_idx
  on public.customer_forms (status);
create trigger customer_forms_updated_at
  before update on public.customer_forms
  for each row execute function set_updated_at();

-- Response captured at submission time. Separate table (vs columns
-- on customer_forms) so we could support multiple responses later
-- — today there's always exactly one. Stores the per-item answers,
-- the signature PNG, and the audit trail.
create table if not exists public.customer_form_responses (
  id               uuid primary key default uuid_generate_v4(),
  form_id          uuid not null references public.customer_forms(id) on delete cascade,
  -- Per-item answers keyed by item.key. Example:
  --   { "mix_3500psi": { confirmed: true, initials: "J.D." },
  --     "color_charcoal": { confirmed: true, initials: "J.D." },
  --     "notes": { value: "Please be gentle with the rose bushes" } }
  answers          jsonb not null default '{}'::jsonb,
  signer_name      text not null,
  signature_png    text,           -- data URL, optional for ack forms
  captured_ip      text,
  captured_user_agent text,
  submitted_at     timestamptz not null default now()
);
create index if not exists customer_form_responses_form_idx
  on public.customer_form_responses (form_id);

alter table public.customer_forms enable row level security;
alter table public.customer_form_responses enable row level security;

create policy "office reads customer forms" on public.customer_forms
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes customer forms" on public.customer_forms
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "office reads customer form responses"
  on public.customer_form_responses
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
-- Public inserts happen via service-role client from the public form
-- submit action; no anon policy needed.

-- ========================================================================
-- 4. crew_photo_reminders — daily 4pm cron audit
-- ========================================================================
create table if not exists public.crew_photo_reminders (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  -- Denormalized: how many photos had this user uploaded to the
  -- project at the time the reminder fired. Lets us render
  -- compliance ("Alex uploaded 4, Willy uploaded 0") without joining
  -- back through attachments/photos.
  uploads_at_send int not null default 0,
  channel        text not null default 'sms',    -- 'sms' | 'push' | 'email'
  message_id     text,                           -- OpenPhone message id
  unique (project_id, user_id, sent_at)
);
create index if not exists crew_photo_reminders_project_idx
  on public.crew_photo_reminders (project_id, sent_at desc);

alter table public.crew_photo_reminders enable row level security;
create policy "office reads crew photo reminders"
  on public.crew_photo_reminders
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes crew photo reminders"
  on public.crew_photo_reminders
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

-- ========================================================================
-- 5. projects: add demo_ack_gate flag
-- ========================================================================
-- When true (the default going forward), projects cannot move to
-- 'active' until the demo_ack customer_form is completed. Existing
-- projects default to false so they aren't retroactively blocked.
alter table public.projects
  add column if not exists demo_ack_required boolean not null default true,
  add column if not exists demo_ack_at       timestamptz;

-- ========================================================================
-- 5b. communications: add 'email' channel for the email-auto-attach cron
-- ========================================================================
do $$ begin
  alter type public.comm_channel add value if not exists 'email';
exception when undefined_object then null; end $$;

-- ========================================================================
-- 6. business_profile: welcome video URL + phase-text template columns
-- ========================================================================
alter table public.business_profile
  add column if not exists welcome_video_url text,
  -- Phase-text templates with merge tokens: {client_name}, {address},
  -- {dates}, {service_type}. When unset, lib/phases.ts falls back to
  -- hardcoded defaults.
  add column if not exists phase_text_demo    text,
  add column if not exists phase_text_prep    text,
  add column if not exists phase_text_pour    text,
  add column if not exists phase_text_cleanup text,
  -- Destination phone numbers. Comma-separated — lib/phases.ts
  -- re-splits and normalizes via normalizePhone().
  add column if not exists phase_to_demo      text,    -- Willy
  add column if not exists phase_to_pour      text;    -- Willy + Roger + Michael
