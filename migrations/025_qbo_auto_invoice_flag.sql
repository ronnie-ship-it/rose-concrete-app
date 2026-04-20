-- Rose Concrete — QBO auto-invoice feature flag
--
-- When a customer accepts a quote on /q/<token> and locks their payment
-- method, the accept action kicks off `autoInvoiceForApprovedQuote`. That
-- function is gated by the `qbo_auto_invoice` flag so Ronnie can flip it
-- off without a redeploy (e.g. during a QBO outage). Defaults OFF so the
-- first quote accept after this migration runs in the existing manual
-- "Generate invoice" flow; flip to true in Supabase (or a settings page)
-- once QBO_ACCESS_TOKEN + QBO_REALM_ID are set in Vercel.
--
-- Run in Supabase SQL editor. Idempotent.

insert into public.feature_flags (key, enabled, config)
values ('qbo_auto_invoice', false, '{}'::jsonb)
on conflict (key) do nothing;
