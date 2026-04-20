-- Rose Concrete — fix infinite RLS recursion on public.profiles
--
-- The "admin reads all profiles" policy in 001_init.sql evaluates by doing a
-- SELECT on public.profiles from inside its own USING clause. That re-enters
-- the policy on the same row, which re-enters again, which Postgres
-- short-circuits as SQLSTATE 42P17 ("infinite recursion detected in policy
-- for relation 'profiles'"). Diagnosed 2026-04-14 when dev-login finally
-- carried cookies through to /dashboard, middleware saw the user, but
-- requireUser()/getSessionUser() couldn't read the profile row and
-- redirected to /login.
--
-- Fix: wrap the role check in a SECURITY DEFINER function. SECURITY DEFINER
-- runs with the function owner's privileges and bypasses RLS on the tables
-- it touches, so the subquery no longer re-enters profile policies.
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- 1. Helper function: "is the caller an admin?"
--    STABLE so the planner can cache within a query. SECURITY DEFINER so it
--    reads profiles without triggering RLS recursion. Search path pinned to
--    public for safety (CVE-2018-1058 class).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2. Same idea for the "office or admin" check used across business tables.
--    Not strictly required to fix the recursion (those policies live on
--    OTHER tables and don't recurse), but standardizing on these helpers
--    makes future policy writes shorter and avoids the trap if anyone ever
--    adds a self-referential policy on profiles.
create or replace function public.is_office_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'office')
  );
$$;

revoke all on function public.is_office_or_admin() from public;
grant execute on function public.is_office_or_admin() to authenticated;

-- 3. Replace the recursive admin policy with one that uses the helper.
drop policy if exists "admin reads all profiles" on public.profiles;

create policy "admin reads all profiles" on public.profiles
  for select using (public.is_admin());

-- The "own profile readable" policy (auth.uid() = id) stays as-is —
-- it's non-recursive and it's what getSessionUser() relies on.
