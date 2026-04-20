-- Rose Concrete — OpenPhone communications log + tasks
--
-- `communications` is the audit trail for every call/text tied to a client.
-- OpenPhone MCP backfill populates rows; adapter stubs return nothing
-- until creds are wired.
--
-- `tasks` is the generic follow-up queue: missed calls auto-seed a row,
-- Ronnie sees them on /dashboard.
--
-- Run in Supabase SQL editor.

do $$ begin
  create type comm_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comm_channel as enum ('call', 'sms');
exception when duplicate_object then null; end $$;

create table if not exists public.communications (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid references public.clients(id) on delete set null,
  external_id   text unique,                    -- OpenPhone message/call id
  direction     comm_direction not null,
  channel       comm_channel not null,
  phone_number  text not null,                  -- e164-normalized when possible
  started_at    timestamptz not null,
  duration_s    int,                            -- call only
  body          text,                           -- sms body
  recording_url text,                           -- call recording
  transcript    text,                           -- call transcript
  was_missed    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists communications_client_idx
  on public.communications (client_id, started_at desc);
create index if not exists communications_phone_idx
  on public.communications (phone_number, started_at desc);

alter table public.communications enable row level security;
create policy "admin office full access communications"
  on public.communications for all using (public.is_office_or_admin());

do $$ begin
  create type task_status as enum ('open', 'done', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text,
  status      task_status not null default 'open',
  client_id   uuid references public.clients(id) on delete set null,
  project_id  uuid references public.projects(id) on delete set null,
  source      text,                             -- 'missed_call', 'manual', etc.
  source_id   text,                             -- external reference (e.g. communications.id)
  due_at      timestamptz,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_open_idx on public.tasks (status, due_at nulls last);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function set_updated_at();

alter table public.tasks enable row level security;
create policy "admin office full access tasks"
  on public.tasks for all using (public.is_office_or_admin());
