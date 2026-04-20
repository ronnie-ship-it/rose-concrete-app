-- Rose Concrete — Task board (Kanban) extensions
--
-- Extends the existing `public.tasks` table (migration 013) with the
-- columns needed for a drag-and-drop Kanban board at /dashboard/tasks.
--
-- Run in Supabase SQL editor.

do $$ begin
  create type task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_kanban_column as enum ('todo', 'in_progress', 'review', 'done');
exception when duplicate_object then null; end $$;

alter table public.tasks
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null,
  add column if not exists priority task_priority not null default 'normal',
  add column if not exists kanban_column task_kanban_column not null default 'todo',
  add column if not exists sort_order int not null default 0,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

-- Backfill kanban_column from legacy status where needed.
update public.tasks
   set kanban_column = 'done'
 where status = 'done' and kanban_column = 'todo';

create index if not exists tasks_kanban_idx
  on public.tasks (kanban_column, sort_order);
create index if not exists tasks_assignee_idx
  on public.tasks (assignee_id, kanban_column)
  where status = 'open';

-- Templated checklists that fire when a quote is approved.
create table if not exists public.task_templates (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  body          text,
  trigger       text not null default 'quote_approved', -- 'quote_approved' | 'manual'
  days_after    int not null default 0,
  priority      task_priority not null default 'normal',
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.task_templates enable row level security;
create policy "admin office read task_templates"
  on public.task_templates for select using (public.is_office_or_admin());
create policy "admin write task_templates"
  on public.task_templates for all using (public.is_admin())
  with check (public.is_admin());

-- Seed a minimal set of post-quote-approval tasks the first time this runs.
insert into public.task_templates (title, body, days_after, priority, sort_order)
select * from (values
  ('Confirm scheduled start date', 'Call client to lock in the pour date.', 0, 'high'::task_priority, 10),
  ('Order concrete', 'Call ready-mix yard. Confirm truck count.', 2, 'high'::task_priority, 20),
  ('Permit check', 'If permit is required, confirm application submitted.', 1, 'normal'::task_priority, 30),
  ('Crew assignment', 'Assign lead + crew to the job.', 1, 'normal'::task_priority, 40),
  ('Deposit received', 'Verify 50% deposit has cleared before scheduling.', 0, 'urgent'::task_priority, 5)
) as v(title, body, days_after, priority, sort_order)
where not exists (select 1 from public.task_templates);

-- Default SMS group for concrete orders: Willy, Roger, Michael.
create table if not exists public.concrete_order_contacts (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  phone        text not null,
  role         text,                            -- 'driver', 'dispatcher', etc.
  is_default   boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.concrete_order_contacts enable row level security;
create policy "admin office read concrete_order_contacts"
  on public.concrete_order_contacts for select using (public.is_office_or_admin());
create policy "admin write concrete_order_contacts"
  on public.concrete_order_contacts for all using (public.is_admin())
  with check (public.is_admin());

insert into public.concrete_order_contacts (name, phone, role, sort_order)
select * from (values
  ('Willy',   '+10000000001', 'Driver',    10),
  ('Roger',   '+10000000002', 'Driver',    20),
  ('Michael', '+10000000003', 'Dispatcher', 30)
) as v(name, phone, role, sort_order)
where not exists (select 1 from public.concrete_order_contacts);

-- Concrete orders log — every group text saved as a structured record.
create table if not exists public.concrete_orders (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid references public.projects(id) on delete set null,
  pour_date      date,
  pour_time      time,
  yards          numeric,
  psi            text,
  slump          text,
  mix_notes      text,
  delivery_address text,
  site_contact   text,
  site_phone     text,
  recipients     jsonb not null default '[]'::jsonb, -- snapshot of names+phones
  message_body   text not null,
  sent_at        timestamptz,
  sent_by        uuid references public.profiles(id) on delete set null,
  status         text not null default 'draft',      -- 'draft' | 'sent' | 'failed'
  openphone_refs jsonb not null default '{}'::jsonb, -- per-recipient message ids / errors
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger concrete_orders_updated_at before update on public.concrete_orders
  for each row execute function set_updated_at();
alter table public.concrete_orders enable row level security;
create policy "admin office full access concrete_orders"
  on public.concrete_orders for all using (public.is_office_or_admin());

-- Change orders — mobile signature + PDF.
create table if not exists public.change_orders (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  number           int not null,
  title            text not null,
  description      text,
  additional_cost  numeric(12,2) not null default 0,
  additional_days  int not null default 0,
  status           text not null default 'draft',   -- 'draft' | 'sent' | 'signed' | 'rejected'
  signed_name      text,
  signed_at        timestamptz,
  signature_data_url text,
  pdf_storage_key  text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, number)
);
create trigger change_orders_updated_at before update on public.change_orders
  for each row execute function set_updated_at();
alter table public.change_orders enable row level security;
create policy "admin office full access change_orders"
  on public.change_orders for all using (public.is_office_or_admin());

-- Public sign link for a change order — lets the customer open on phone
-- without logging in.
alter table public.change_orders
  add column if not exists public_token text unique;
update public.change_orders
   set public_token = replace(gen_random_uuid()::text, '-', '')
 where public_token is null;

-- Pre-inspection / completion / custom job forms fill log, mobile-first.
-- Leverages `job_form_templates` + `job_form_instances` from migration 021
-- but adds a `kind` column so crew lists filter quickly.
alter table public.job_form_templates
  add column if not exists kind text not null default 'custom';
alter table public.job_form_instances
  add column if not exists photos_required int not null default 1,
  add column if not exists photos_captured int not null default 0,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;

-- Gmail auto-forward watched label for the sidewalk workflow.
create table if not exists public.gmail_watched_senders (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  label       text,
  note        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.gmail_watched_senders enable row level security;
create policy "admin office read gmail_watched_senders"
  on public.gmail_watched_senders for select using (public.is_office_or_admin());
create policy "admin write gmail_watched_senders"
  on public.gmail_watched_senders for all using (public.is_admin())
  with check (public.is_admin());
