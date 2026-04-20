-- 039_cash_journal.sql
--
-- Cash journal for day laborers — separate from payroll/timesheets
-- because it captures the off-book cash Ronnie pays out (tool rental
-- reimbursements, per-diem helpers, delivery tips). Foreman logs each
-- entry from the crew PWA; weekly totals + PDF export live on the
-- admin dashboard.
--
-- Additive. No existing tables touched.

do $$ begin
  create type cash_journal_kind as enum (
    'labor',        -- day laborer / helper wages
    'tool_rental',  -- home depot, sunbelt, bobcat
    'delivery',     -- concrete trucking, material drop-offs, tips
    'materials',    -- quick hardware runs paid in cash
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.cash_journal_entries (
  id             uuid primary key default uuid_generate_v4(),
  entry_date     date not null default current_date,
  worker_name    text not null,                  -- free-form; day laborers don't have profile rows
  kind           cash_journal_kind not null default 'labor',
  description    text,
  amount_cents   integer not null check (amount_cents >= 0),
  project_id     uuid references public.projects(id) on delete set null,
  -- Foreman acknowledges each entry with a signed-off flag.
  foreman_id     uuid references public.profiles(id) on delete set null,
  foreman_signed_at timestamptz,
  receipt_attachment_id uuid references public.attachments(id) on delete set null,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cash_journal_entries_date_idx
  on public.cash_journal_entries (entry_date desc);
create index if not exists cash_journal_entries_project_idx
  on public.cash_journal_entries (project_id)
  where project_id is not null;
create index if not exists cash_journal_entries_worker_idx
  on public.cash_journal_entries (worker_name);
create trigger cash_journal_entries_updated_at
  before update on public.cash_journal_entries
  for each row execute function set_updated_at();

alter table public.cash_journal_entries enable row level security;

-- Crew can insert their own entries + see their own. Office + admin
-- see everything and can sign off / edit / delete.
create policy "crew reads own cash entries" on public.cash_journal_entries
  for select using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "crew inserts cash entries" on public.cash_journal_entries
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('admin', 'office', 'crew'))
  );
create policy "office writes cash entries" on public.cash_journal_entries
  for update using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office deletes cash entries" on public.cash_journal_entries
  for delete using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
