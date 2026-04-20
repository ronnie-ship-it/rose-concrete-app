-- Rose Concrete — payment method + credit-card processing fee
--
-- Ronnie passes the processing fee through to the client. Standard rate is
-- 2.9% + $0.30 per charge (matches QBO Payments / Stripe defaults). We
-- store the rate in `invoice_settings` so Ronnie can change it from the
-- settings page without a redeploy if a processor swap changes the math.
--
-- The client picks check or credit_card on the milestone; if credit_card
-- we record the fee so the amount the client owes is (amount + fee_amount).
-- App still never moves money — QBO is the book of record — but we need to
-- show the two totals on the customer-facing invoice/pay page.
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- ===== invoice_settings =====
-- One row, keyed on singleton=true. Easier than a k/v table for this.
create table if not exists public.invoice_settings (
  singleton              boolean primary key default true,
  cc_fee_percent         numeric(5, 4) not null default 0.0290,   -- 2.90%
  cc_fee_flat_cents      int not null default 30,                  -- + $0.30
  cc_fee_absorb          boolean not null default false,           -- true = Ronnie eats the fee; false = pass to client
  check_instructions     text not null default 'Make checks payable to Rose Concrete. Mail or drop off at job site.',
  updated_at             timestamptz not null default now(),
  constraint invoice_settings_singleton check (singleton = true)
);

-- Seed the singleton row if it doesn't exist yet.
insert into public.invoice_settings (singleton) values (true)
on conflict (singleton) do nothing;

create trigger invoice_settings_updated_at before update on public.invoice_settings
  for each row execute function set_updated_at();

alter table public.invoice_settings enable row level security;

create policy "anyone authenticated reads invoice settings"
  on public.invoice_settings
  for select using (auth.role() = 'authenticated');

create policy "admin writes invoice settings"
  on public.invoice_settings
  for all using (public.is_admin())
  with check (public.is_admin());

-- ===== payment method on milestones =====
create type payment_method as enum ('check', 'credit_card');

alter table public.payment_milestones
  add column if not exists payment_method     payment_method,
  add column if not exists fee_amount         numeric(12, 2) not null default 0,
  add column if not exists total_with_fee     numeric(12, 2); -- computed on selection

-- Hot-path index for the receipts worker when we need to know which
-- milestones were paid by card (different receipt language).
create index if not exists payment_milestones_method_idx
  on public.payment_milestones (payment_method)
  where payment_method is not null;
