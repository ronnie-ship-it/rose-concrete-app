-- 040_multi_tenant.sql
--
-- Multi-tenant foundation. Every data row now belongs to a `tenant`
-- (one row per concrete contractor / company using the app). Users
-- are pinned to a single tenant via `profiles.tenant_id`; all RLS
-- policies enforce isolation by joining back to the caller's tenant.
--
-- Fully idempotent. The migration previously failed with
--   ERROR: 42703: column tenant_id does not exist
-- because downstream `alter table ... enable row level security` +
-- `create policy` statements ran outside the per-table existence
-- check, so a missing column on any table brought the whole thing
-- down. This rewrite moves ALL per-table work into a single helper
-- function `_apply_tenant_scope(target_table)` that:
--   1. skips if the table doesn't exist
--   2. adds `tenant_id` if missing
--   3. backfills to the Rose default
--   4. creates the index
--   5. enables RLS
--   6. drops every existing policy on the table and replaces with a
--      single tenant-scoped policy
--   7. attaches the auto-stamp BEFORE INSERT trigger
--
-- Re-running the migration is safe: every step uses `if not exists`
-- / `drop policy if exists` / `create or replace` so the second run
-- is a no-op.

-- ========================================================================
-- 1. tenants table
-- ========================================================================
create table if not exists public.tenants (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique,
  owner_id    uuid references public.profiles(id) on delete set null,
  plan        text not null default 'starter',     -- 'starter' | 'pro' | 'enterprise'
  status      text not null default 'active',      -- 'active' | 'suspended' | 'trial'
  trial_ends_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tenants_updated_at'
  ) then
    create trigger tenants_updated_at before update on public.tenants
      for each row execute function set_updated_at();
  end if;
end$$;

alter table public.tenants enable row level security;
drop policy if exists "read own tenant" on public.tenants;
create policy "read own tenant" on public.tenants
  for select using (
    id in (select tenant_id from public.profiles where id = auth.uid())
  );
drop policy if exists "admin updates own tenant" on public.tenants;
create policy "admin updates own tenant" on public.tenants
  for update using (
    id in (
      select tenant_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ========================================================================
-- 2. Seed the default Rose Concrete tenant (stable uuid for backfills)
-- ========================================================================
insert into public.tenants (id, name, slug, plan, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Rose Concrete',
  'rose-concrete',
  'enterprise',
  'active'
)
on conflict (id) do nothing;

-- ========================================================================
-- 3. pending_tenant_signups table — bridge between signup form and
--    the handle_new_user() trigger.
-- ========================================================================
create table if not exists public.pending_tenant_signups (
  email       text primary key,
  company_name text not null,
  created_at  timestamptz not null default now()
);
alter table public.pending_tenant_signups enable row level security;
-- No RLS policies — only service-role inserts/reads this table.

-- ========================================================================
-- 4. profiles: tenant_id column (special-cased — every other table
--    goes through the helper below, but we need profiles wired up
--    before current_tenant_id() can read from it).
-- ========================================================================
alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

update public.profiles
set tenant_id = '11111111-1111-1111-1111-111111111111'
where tenant_id is null;

do $$ begin
  -- Make NOT NULL only after backfill, and only if it isn't already.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'tenant_id'
      and is_nullable = 'YES'
  ) then
    alter table public.profiles alter column tenant_id set not null;
  end if;
end$$;

create index if not exists profiles_tenant_idx on public.profiles (tenant_id);

-- Set owner_id for the Rose tenant to its oldest admin (if any).
update public.tenants
set owner_id = (
  select id from public.profiles
  where tenant_id = tenants.id and role = 'admin'
  order by created_at asc
  limit 1
)
where id = '11111111-1111-1111-1111-111111111111' and owner_id is null;

-- ========================================================================
-- 5. Helper functions — current_tenant_id() + auto_stamp_tenant_id()
-- ========================================================================
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auto_stamp_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := public.current_tenant_id();
  end if;
  return new;
end;
$$;

-- ========================================================================
-- 6. _apply_tenant_scope(target_table) — the workhorse helper. Does
--    everything for one table, or skips if the table doesn't exist.
-- ========================================================================
create or replace function public._apply_tenant_scope(target_table text)
returns void
language plpgsql
as $fn$
declare
  has_table boolean;
  policy_rec record;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = target_table
  ) into has_table;
  if not has_table then
    raise notice 'skipping tenant scope: public.% does not exist', target_table;
    return;
  end if;

  -- 1. Add tenant_id if missing.
  execute format(
    'alter table public.%I add column if not exists tenant_id uuid '
    || 'references public.tenants(id) on delete cascade',
    target_table
  );

  -- 2. Backfill any existing rows to the Rose tenant.
  execute format(
    'update public.%I set tenant_id = ''11111111-1111-1111-1111-111111111111'' where tenant_id is null',
    target_table
  );

  -- 3. Index (IF NOT EXISTS is safe to re-run).
  execute format(
    'create index if not exists %I on public.%I (tenant_id)',
    target_table || '_tenant_idx', target_table
  );

  -- 4. Enable RLS.
  execute format('alter table public.%I enable row level security', target_table);

  -- 5. Drop every existing policy on the table, then install the one
  --    tenant-scoped policy. We drop-all-then-create because:
  --    (a) the previous migrations added role-based policies whose
  --        names vary per table, and enumerating them all is brittle.
  --    (b) role-level gating (admin / office / crew) is enforced in
  --        the app layer via requireRole(); RLS's job in this
  --        migration is pure tenant isolation.
  for policy_rec in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = target_table
  loop
    execute format(
      'drop policy %I on public.%I',
      policy_rec.policyname, target_table
    );
  end loop;

  execute format(
    'create policy %I on public.%I for all '
    || 'using (tenant_id = public.current_tenant_id()) '
    || 'with check (tenant_id = public.current_tenant_id())',
    'tenant scope ' || target_table, target_table
  );

  -- 6. Attach the auto-stamp BEFORE INSERT trigger.
  execute format(
    'drop trigger if exists stamp_tenant_id on public.%I',
    target_table
  );
  execute format(
    'create trigger stamp_tenant_id before insert on public.%I '
    || 'for each row execute function public.auto_stamp_tenant_id()',
    target_table
  );
end;
$fn$;

-- ========================================================================
-- 7. Apply the helper to every tenant-scoped table. Missing tables
--    are gracefully skipped with a NOTICE.
-- ========================================================================
do $$
declare
  tbl text;
  scoped_tables text[] := array[
    'clients', 'projects', 'quotes', 'leads',
    'tasks', 'communications', 'notifications',
    'activity_log', 'feature_flags', 'line_item_templates',
    'automation_rules', 'custom_field_definitions',
    'attachments', 'photos', 'notes', 'calls',
    'discount_codes', 'tax_rates', 'message_templates',
    'job_forms', 'gmail_watched_senders', 'cash_journal_entries',
    'customer_forms', 'project_phases', 'business_profile',
    'invoice_settings'
  ];
begin
  foreach tbl in array scoped_tables loop
    perform public._apply_tenant_scope(tbl);
  end loop;
end$$;

-- ========================================================================
-- 8. business_profile + invoice_settings — special handling to swap
--    their old singleton constraint for a per-tenant unique index.
--    The _apply_tenant_scope helper already added tenant_id + RLS;
--    this block just finishes the "one row per tenant" rewrite.
-- ========================================================================
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_profile'
      and column_name = 'tenant_id'
  ) then
    -- Drop the old singleton check constraint if it exists.
    execute 'alter table public.business_profile drop constraint if exists business_profile_singleton';
    -- Unique per tenant.
    execute 'drop index if exists business_profile_tenant_unique';
    execute 'create unique index if not exists business_profile_tenant_unique on public.business_profile (tenant_id)';
  end if;
end$$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_settings'
      and column_name = 'tenant_id'
  ) then
    execute 'alter table public.invoice_settings drop constraint if exists invoice_settings_singleton';
    execute 'drop index if exists invoice_settings_tenant_unique';
    execute 'create unique index if not exists invoice_settings_tenant_unique on public.invoice_settings (tenant_id)';
  end if;
end$$;

-- ========================================================================
-- 9. profiles: install tenant-scoped RLS. Different from the helper
--    because profiles has to remain readable by the user themselves
--    (so they can see their own role + profile on signup/login) as
--    well as by teammates in the same tenant.
-- ========================================================================
alter table public.profiles enable row level security;

-- Drop every existing profiles policy, then install the three we want.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end$$;

create policy "read own + same tenant profiles" on public.profiles
  for select using (
    id = auth.uid()
    or tenant_id = public.current_tenant_id()
  );

create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "admin updates tenant profiles" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.tenant_id = profiles.tenant_id
    )
  );

-- ========================================================================
-- 10. handle_new_user() — rewire so new signups pick up a pending
--     tenant row or fall back to the Rose default.
-- ========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending         record;
  new_tenant_id   uuid;
  is_first_profile boolean;
begin
  -- New tenant signup? The /signup page writes a pending row before
  -- calling signInWithOtp, so the row is there by the time the user
  -- clicks the magic link.
  select * into pending from public.pending_tenant_signups where email = new.email;

  if pending.email is not null then
    insert into public.tenants (name, plan, status, trial_ends_at)
      values (
        pending.company_name,
        'starter',
        'trial',
        now() + interval '14 days'
      )
      returning id into new_tenant_id;

    insert into public.profiles (id, email, full_name, role, tenant_id)
      values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name',
                 split_part(new.email, '@', 1)),
        'admin'::user_role,
        new_tenant_id
      )
      on conflict (id) do nothing;

    update public.tenants set owner_id = new.id where id = new_tenant_id;

    -- Seed the workspace: business_profile + invoice_settings rows
    -- (if the tables exist) and feature_flags cloned from Rose with
    -- everything disabled.
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'business_profile'
    ) then
      insert into public.business_profile (tenant_id, company_name)
        values (new_tenant_id, pending.company_name)
        on conflict do nothing;
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'invoice_settings'
    ) then
      insert into public.invoice_settings (tenant_id)
        values (new_tenant_id)
        on conflict do nothing;
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'feature_flags'
    ) then
      insert into public.feature_flags (tenant_id, key, enabled)
      select new_tenant_id, key, false
      from public.feature_flags
      where tenant_id = '11111111-1111-1111-1111-111111111111'
      on conflict do nothing;
    end if;

    delete from public.pending_tenant_signups where email = new.email;
    return new;
  end if;

  -- Legacy path: first-ever profile = admin of Rose tenant; subsequent
  -- signups without a pending row = crew of Rose tenant (dev / staff
  -- convenience — the /signup flow is the real onboarding path).
  select not exists (select 1 from public.profiles) into is_first_profile;
  insert into public.profiles (id, email, full_name, role, tenant_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name',
               split_part(new.email, '@', 1)),
      case when is_first_profile then 'admin'::user_role else 'crew'::user_role end,
      '11111111-1111-1111-1111-111111111111'
    )
    on conflict (id) do nothing;
  return new;
end;
$$;

-- The trigger itself is defined in migration 002; we only needed to
-- replace the function body. But re-creating the trigger is safe and
-- catches cases where the migration is applied to a fresh DB without
-- 002 (shouldn't happen, but cheap safety net).
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end$$;

-- ========================================================================
-- 11. is_office_or_admin() — tighten to require same tenant.
-- ========================================================================
create or replace function public.is_office_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'office')
      and tenant_id = public.current_tenant_id()
  );
$$;
