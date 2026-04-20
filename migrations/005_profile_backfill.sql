-- Rose Concrete — profile bootstrap fix
--
-- Background: migration 002 installed the on_auth_user_created trigger that
-- auto-creates a public.profiles row for every new auth.users row. Users
-- created BEFORE 002 ran never got a profile — and because public.profiles
-- has no INSERT RLS policy, a user-context Supabase client cannot heal this
-- on its own. A missing profile loops the magic-link flow:
--
--   callback → session set → profile lookup returns null →
--   getSessionUser() returns null → requireUser() redirects to /login → loop
--
-- This migration does two things:
--   1. Backfill a profiles row for every auth.users row that doesn't have one.
--   2. Expose ensure_current_profile() as a SECURITY DEFINER RPC so the app
--      can self-heal on every login without relying on the migration having
--      run for every user that will ever exist.

-- ===== 1. One-time backfill =====
-- Preserves the "first user is admin" rule: whichever auth.users row has the
-- earliest created_at among rows without a profile gets 'admin' — but ONLY if
-- no admin profile already exists. Otherwise everyone backfilled is 'crew'
-- and Ronnie can promote them from the admin console.
with
  needs_profile as (
    select u.id, u.email, u.raw_user_meta_data, u.created_at
    from auth.users u
    where not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  ),
  has_admin as (
    select exists (select 1 from public.profiles where role = 'admin') as yes
  ),
  first_candidate as (
    select id from needs_profile order by created_at asc limit 1
  )
insert into public.profiles (id, email, full_name, role)
select
  np.id,
  np.email,
  coalesce(
    np.raw_user_meta_data->>'full_name',
    split_part(np.email, '@', 1)
  ),
  case
    when not (select yes from has_admin) and np.id = (select id from first_candidate)
      then 'admin'::user_role
    else 'crew'::user_role
  end
from needs_profile np
on conflict (id) do nothing;

-- ===== 2. Self-healing RPC =====
-- Idempotent: if a profile already exists for the caller, does nothing.
-- Callable from any authenticated client (see grant below) so the Next.js
-- app can invoke it via supabase.rpc('ensure_current_profile') from the
-- magic-link callback + getSessionUser.
--
-- SECURITY DEFINER because public.profiles has no INSERT RLS policy — this
-- function is the single trusted path for a user to create their own row.
-- We never trust the caller for the role: it always defaults to 'crew' (or
-- 'admin' if they happen to be the very first user).
create or replace function public.ensure_current_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
  v_is_first boolean;
begin
  if v_uid is null then
    raise exception 'ensure_current_profile called without an authenticated user';
  end if;

  -- Fast path: profile already exists.
  select * into v_profile from public.profiles where id = v_uid;
  if found then
    return v_profile;
  end if;

  -- Load the auth.users row so we can copy email + metadata.
  select * into v_user from auth.users where id = v_uid;
  if not found then
    raise exception 'no auth.users row for %', v_uid;
  end if;

  -- Preserve the "first user becomes admin" rule from migration 002.
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, email, full_name, role)
  values (
    v_user.id,
    v_user.email,
    coalesce(
      v_user.raw_user_meta_data->>'full_name',
      split_part(v_user.email, '@', 1)
    ),
    case when v_is_first then 'admin'::user_role else 'crew'::user_role end
  )
  on conflict (id) do nothing
  returning * into v_profile;

  -- on conflict branch means another request won the race; re-read.
  if v_profile.id is null then
    select * into v_profile from public.profiles where id = v_uid;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.ensure_current_profile() from public;
grant execute on function public.ensure_current_profile() to authenticated;
