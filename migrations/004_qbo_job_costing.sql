-- Rose Concrete — Phase 2 QBO Job Costing
-- Adds the columns needed to match QuickBooks expenses to projects, plus an
-- import log so we can trust what was loaded and roll back a bad file.
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- ===== Projects: QBO linkage for matching =====
alter table public.projects
  add column if not exists qbo_customer_id   text,
  add column if not exists qbo_customer_name text;

create index if not exists projects_qbo_customer_id_idx
  on public.projects (qbo_customer_id)
  where qbo_customer_id is not null;

create index if not exists projects_qbo_customer_name_idx
  on public.projects (lower(qbo_customer_name))
  where qbo_customer_name is not null;

-- ===== Job costs: matching metadata =====
-- How a row got its project_id. Helps us (a) audit matches, (b) let the
-- unmatched queue target the rows a human still needs to touch, and (c) avoid
-- blowing away a manual assignment on the next CSV re-import.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_cost_match_source') then
    create type job_cost_match_source as enum (
      'unmatched',
      'auto_customer',  -- matched via QBO customer id
      'auto_name',      -- matched via fuzzy customer-name match
      'manual'          -- a human assigned it from the unmatched queue
    );
  end if;
end$$;

alter table public.job_costs
  add column if not exists match_source   job_cost_match_source not null default 'unmatched',
  add column if not exists raw_customer   text,
  add column if not exists import_id      uuid,
  add column if not exists created_at     timestamptz not null default now();

create index if not exists job_costs_match_source_idx
  on public.job_costs (match_source);

-- ===== QBO imports =====
-- Every CSV upload lands here first. job_costs.import_id points back so we can
-- show "the Feb 12 import added 84 rows / matched 62 / 22 unmatched" and let
-- an admin delete an entire bad import in one click.
create table if not exists public.qbo_imports (
  id             uuid primary key default uuid_generate_v4(),
  uploaded_by    uuid references public.profiles(id) on delete set null,
  source         text not null default 'csv', -- 'csv' today, 'api' later
  filename       text,
  row_count      int not null default 0,
  matched_count  int not null default 0,
  skipped_count  int not null default 0,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists qbo_imports_created_idx
  on public.qbo_imports (created_at desc);

alter table public.qbo_imports enable row level security;

create policy "admin office read qbo imports" on public.qbo_imports
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "admin office write qbo imports" on public.qbo_imports
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

-- ===== Job costs RLS (not set in 001) =====
-- 001 enabled RLS on job_costs but didn't add policies, so nothing can read or
-- write it today. Phase 2 needs both for admin/office.
drop policy if exists "admin office read job costs" on public.job_costs;
create policy "admin office read job costs" on public.job_costs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

drop policy if exists "admin office write job costs" on public.job_costs;
create policy "admin office write job costs" on public.job_costs
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

-- ===== Recompute cached margin for one project =====
-- The plan stores revenue_cached / cost_cached / margin_cached on projects so
-- list pages and dashboard widgets don't have to aggregate on every read.
-- This function is the single source of truth for that math and gets called
-- from the CSV import server action + any time a job_costs row changes project.
create or replace function public.recompute_project_profitability(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revenue numeric(12, 2) := 0;
  v_cost    numeric(12, 2) := 0;
begin
  -- Revenue = accepted_total of the most recent accepted quote for this project.
  -- (We only count real, client-accepted money; draft quotes are not revenue.)
  select coalesce(accepted_total, 0)
    into v_revenue
  from public.quotes
  where project_id = p_project_id
    and status = 'accepted'
  order by accepted_at desc nulls last, issued_at desc
  limit 1;

  select coalesce(sum(amount), 0)
    into v_cost
  from public.job_costs
  where project_id = p_project_id;

  update public.projects
     set revenue_cached = coalesce(v_revenue, 0),
         cost_cached    = coalesce(v_cost, 0),
         margin_cached  = coalesce(v_revenue, 0) - coalesce(v_cost, 0)
   where id = p_project_id;
end;
$$;
