-- 035_push_subscriptions.sql
--
-- Web Push subscription records. One row per browser/device that has
-- opted into notifications. The triple (endpoint, p256dh, auth) is the
-- raw PushSubscription payload the browser hands us at subscribe time —
-- we hand it right back when sending a push.
--
-- NOTE: Actually sending a push requires VAPID keys (public + private)
-- set in env. Ronnie hasn't wired those yet; `lib/push.ts` will best-effort
-- no-op when the keys aren't present. Subscriptions are still collected
-- so the table's ready to go the moment keys land.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- The browser-provided endpoint is unique per subscription and already
  -- long (~200 chars); we key off it to upsert on re-subscribe.
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Each user manages their own subscription rows.
drop policy if exists push_subs_own on push_subscriptions;
create policy push_subs_own on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins + office staff can view all subscriptions (useful for debugging
-- "why didn't I get the push" questions).
drop policy if exists push_subs_admin_read on push_subscriptions;
create policy push_subs_admin_read on push_subscriptions
  for select
  using (is_office_or_admin());
