-- Rose Concrete — Public pay-link tokens for payment milestones
--
-- Mirrors the `public_token` column on `quotes` (see 005_quotes.sql). Each
-- milestone gets an opaque random token so Ronnie can text a client a link
-- like https://app.roseconcrete.com/pay/<token> and let them pick check vs
-- credit card without ever logging in. The app still doesn't move money —
-- the client's selection just writes payment_method + fee_amount +
-- total_with_fee back to the row so the QBO invoice can be generated with
-- the right amount.
--
-- Run in Supabase SQL editor.

alter table public.payment_milestones
  add column if not exists pay_token text unique;

-- Backfill existing rows with a fresh token.
update public.payment_milestones
  set pay_token = encode(gen_random_bytes(18), 'hex')
  where pay_token is null;

-- Enforce not-null going forward + default for new rows.
alter table public.payment_milestones
  alter column pay_token set default encode(gen_random_bytes(18), 'hex'),
  alter column pay_token set not null;

-- The public pay page uses the service-role key to read/write through RLS,
-- so we don't need to punch a hole in the existing policies — they already
-- restrict authenticated reads to office/admin, which is fine.
