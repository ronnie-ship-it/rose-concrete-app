-- Auto-create a public.profiles row whenever a new auth.users row is inserted.
-- Role defaults to 'crew' — admin promotes people from the admin console.
-- The very first user to sign up is auto-promoted to 'admin' so Ronnie can
-- bootstrap the system without touching SQL.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first_user then 'admin'::user_role else 'crew'::user_role end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Allow admins to update any profile (for role promotion); users can update
-- their own basic fields but cannot escalate their own role.
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "users update own profile non-role" on public.profiles;
create policy "users update own profile non-role" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
