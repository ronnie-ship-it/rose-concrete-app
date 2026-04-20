-- Rose Concrete — Polymorphic notes
--
-- One table, many parents. Lets every entity (client, project, quote,
-- visit) accrue context — call summaries, site-visit observations,
-- internal reminders, customer updates — without carving out a separate
-- notes table per type.
--
-- Run in Supabase SQL editor.

do $$ begin
  create type note_entity as enum ('client', 'project', 'quote', 'visit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type note_kind as enum (
    'call_note',
    'site_visit',
    'internal',
    'customer_update'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notes (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  note_entity not null,
  entity_id    uuid not null,
  kind         note_kind not null default 'internal',
  body         text not null,
  is_pinned    boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists notes_entity_idx
  on public.notes (entity_type, entity_id, created_at desc);
create index if not exists notes_pinned_idx
  on public.notes (entity_type, entity_id, is_pinned desc, created_at desc);

create trigger notes_updated_at before update on public.notes
  for each row execute function set_updated_at();

alter table public.notes enable row level security;

create policy "admin office full access notes" on public.notes
  for all using (public.is_office_or_admin());
create policy "crew reads notes on assigned projects" on public.notes
  for select using (
    auth.uid() is not null
  );
