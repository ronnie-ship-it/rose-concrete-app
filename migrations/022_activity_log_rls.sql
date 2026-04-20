-- Rose Concrete — activity_log RLS policies
--
-- `public.activity_log` has had `enable row level security` since
-- migration 001, but no policies were ever defined. With RLS on and no
-- policies, every select/insert from the authenticated Supabase client
-- (`createClient()`) is rejected. The effect surfaces a few different
-- ways depending on the caller:
--
--   * Server actions that log activity via the authenticated client
--     (e.g. app/dashboard/projects/actions.ts, schedule/actions.ts,
--     quotes/actions.ts, workflows/actions.ts when invoked via the
--     session client, and the public lead webhook) have their inserts
--     blocked — either silently or with "new row violates row-level
--     security policy" bubbling up as a 500 depending on how the error
--     is surfaced.
--   * The /dashboard/activity feed renders an empty list instead of
--     the real history.
--   * Client detail page (app/dashboard/clients/[id]/page.tsx) that
--     issues a parallel query on activity_log returns zero rows.
--
-- This migration also re-audits every table introduced in migrations
-- 019–021 for missing policies. Result of the audit: all tables in 020
-- (`jobber_oauth_tokens`) and 021 (`notifications`,
-- `client_properties`, `discount_codes`, `tax_rates`,
-- `custom_field_definitions`, `custom_field_values`,
-- `job_form_templates`, `job_form_instances`, `dashboard_prefs`,
-- `automation_config`, `automation_runs`) already have their RLS
-- policies defined in their respective create-table blocks. Migration
-- 019 didn't introduce any new tables — only added `external_id`
-- columns and indexes to existing `notes`, `attachments`, and
-- `clients` (already covered). Nothing to patch there.
--
-- Run in Supabase SQL editor after 021.

-- `activity_log` is effectively an append-only audit stream:
--   * admin + office: full access — they browse /dashboard/activity and
--     their server actions insert rows as side-effects.
--   * everyone authenticated: INSERT only — crew-initiated flows (e.g.
--     marking a visit completed) also drop activity rows via the
--     authenticated client, so they need write but not read.
--
-- No UPDATE / DELETE policies are defined. The table is append-only and
-- Supabase blocks any operation lacking a matching policy, so that's
-- the correct shape for an audit log.

do $$ begin
  create policy "admin office full access activity_log"
    on public.activity_log for all
    using (public.is_office_or_admin())
    with check (public.is_office_or_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated writes activity_log"
    on public.activity_log for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
