-- Rose Concrete — Quote-level payment-method lock + ACH support
--
-- When a customer accepts a quote on the public page they now pick one of
-- three payment methods (check, ACH bank transfer, credit card). Whatever
-- they pick — and the exact total they'll pay — gets locked to the quote
-- alongside their signature. The QBO invoice is then issued for that locked
-- total. No switching allowed after signing.
--
-- Additive / idempotent. Run in Supabase SQL editor.

-- Extend the payment_method enum with 'ach'. Enum additions can't live in
-- a transaction block on older Postgres, so guard with an exception handler.
do $$ begin
  alter type payment_method add value 'ach';
exception when duplicate_object then null;
          when invalid_parameter_value then null;
end $$;

-- ACH fee config on invoice_settings. Default is $10 flat, no percent,
-- pass-through to the customer. Ronnie can edit all three processor rates
-- (card / ach / check-instructions) from /dashboard/settings/invoicing.
alter table public.invoice_settings
  add column if not exists ach_fee_percent    numeric(5, 4) not null default 0.0000,
  add column if not exists ach_fee_flat_cents int not null default 1000, -- $10
  add column if not exists ach_fee_absorb     boolean not null default false;

-- Quote-level lock. These are the numbers that print on the signed receipt
-- + drive the QBO invoice.
alter table public.quotes
  add column if not exists locked_payment_method payment_method,
  add column if not exists locked_base_total     numeric(12, 2),
  add column if not exists locked_fee_amount     numeric(12, 2) not null default 0,
  add column if not exists locked_total_charged  numeric(12, 2),
  add column if not exists locked_at             timestamptz;

comment on column public.quotes.locked_payment_method is
  'Payment method the customer selected at signing. Immutable after accept.';
comment on column public.quotes.locked_base_total is
  'Base job amount (sum of accepted line items) at the moment of signing.';
comment on column public.quotes.locked_fee_amount is
  'Processor/bank fee added for the chosen method at signing (0 for check).';
comment on column public.quotes.locked_total_charged is
  'What the customer will actually be billed (base + fee). Drives the QBO invoice.';
