-- Rose Concrete — Salesperson field + quote status timeline + expenses
--
-- Three additive pieces bundled together because they all drop plain
-- columns / a small table, no enum gymnastics required.
--
-- 1. Salesperson assignment on quotes + projects — FK to profiles.
-- 2. Quote status-timeline breadcrumbs: sent_at / viewed_at /
--    email_opened_at (accepted_at and approved_at already exist).
-- 3. Expenses tracker table — per-project costs Ronnie logs by hand
--    (materials, subs, fuel) separate from the QBO-imported `job_costs`.

-- ===== 1. Salesperson =====
alter table public.quotes
  add column if not exists salesperson_id uuid references public.profiles(id) on delete set null;
alter table public.projects
  add column if not exists salesperson_id uuid references public.profiles(id) on delete set null;

create index if not exists quotes_salesperson_idx
  on public.quotes (salesperson_id)
  where salesperson_id is not null;
create index if not exists projects_salesperson_idx
  on public.projects (salesperson_id)
  where salesperson_id is not null;

-- ===== 2. Quote status timeline =====
alter table public.quotes
  add column if not exists sent_at         timestamptz,
  add column if not exists viewed_at       timestamptz,
  add column if not exists email_opened_at timestamptz,
  add column if not exists declined_at     timestamptz,
  add column if not exists expired_at      timestamptz,
  add column if not exists converted_at    timestamptz;

-- ===== 3. Expenses =====
do $$ begin
  create type expense_category as enum (
    'materials',
    'concrete',
    'rebar',
    'equipment_rental',
    'subcontractor',
    'fuel',
    'permit_fee',
    'labor',
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.expenses (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references public.projects(id) on delete set null,
  vendor        text,
  category      expense_category not null default 'other',
  amount        numeric(12, 2) not null,
  note          text,
  receipt_url   text,                             -- if we attach a photo
  expense_date  date not null default current_date,
  paid_from     text,                             -- 'check', 'card', 'cash'
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function set_updated_at();
create index if not exists expenses_project_idx on public.expenses (project_id, expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category, expense_date desc);

alter table public.expenses enable row level security;
do $$ begin
  create policy "admin office full access expenses"
    on public.expenses for all using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
