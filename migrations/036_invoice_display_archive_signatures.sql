-- 036_invoice_display_archive_signatures.sql
--
-- Jobber-parity polish for the invoice sidebar, client archive,
-- per-product booking visibility, and invoice signature capture.
-- All additive / idempotent — existing rows get sensible defaults.
--
-- Changes:
--   1. payment_schedules gets per-invoice display + payment controls
--      (method toggles, show/hide columns + balance/late stamp,
--       sent timestamp for "Mark as sent", signature capture state).
--   2. clients gets archived_at for soft-delete.
--   3. line_item_templates gets is_bookable_online for per-product
--      booking-form visibility.
--   4. signatures table holds captured invoice / receipt signatures
--      (PNG data URL + captured_at + ip + name).

-- ===== 1. payment_schedules: per-invoice controls =====

alter table public.payment_schedules
  -- Online payment method toggles. Default to "all on" so existing
  -- schedules keep working. Each flag maps to a checkbox in the
  -- sidebar editor — the public /pay/<token> form hides the method
  -- when the flag is off.
  add column if not exists allow_card          boolean not null default true,
  add column if not exists allow_ach           boolean not null default true,
  add column if not exists allow_partial       boolean not null default false,

  -- Client-view display controls — each corresponds to a Jobber
  -- "Client view" checkbox. `show_quantities` and `show_unit_price`
  -- hide the per-line numbers on the public invoice, letting Ronnie
  -- present a rolled-up total when a client is markup-sensitive.
  add column if not exists show_quantities     boolean not null default true,
  add column if not exists show_unit_price     boolean not null default true,
  add column if not exists show_line_totals    boolean not null default true,
  add column if not exists show_account_balance boolean not null default true,
  add column if not exists show_late_stamp     boolean not null default true,

  -- "Mark as sent" — manual override when Ronnie sent the invoice
  -- out-of-band (printed + mailed, forwarded PDF, etc.). Timestamp
  -- is the source of truth; the invoice is "sent" iff this is set.
  add column if not exists sent_at             timestamptz,
  add column if not exists sent_by             uuid references public.profiles(id) on delete set null,
  add column if not exists sent_channel        text, -- 'email' | 'sms' | 'print' | 'manual' | 'app'

  -- Require a signature on acceptance/receipt. When true the public
  -- pay page shows a signature pad before accepting payment.
  add column if not exists require_signature   boolean not null default false;

create index if not exists payment_schedules_sent_idx
  on public.payment_schedules (sent_at)
  where sent_at is not null;

-- ===== 2. clients: soft-delete via archived_at =====

alter table public.clients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

-- Hot-path index so the Clients list can filter archived clients
-- out with a cheap partial-index scan.
create index if not exists clients_archived_at_idx
  on public.clients (archived_at)
  where archived_at is not null;

-- ===== 3. line_item_templates: per-product booking visibility =====

alter table public.line_item_templates
  -- Whether this product/service shows up on the public online-booking
  -- form. Default true so existing services keep showing; Ronnie can
  -- flip internal-only items (labor, material markups) to false.
  add column if not exists is_bookable_online boolean not null default true,
  -- Booking-form friendly name (optional override of `title`).
  add column if not exists booking_display_name text;

-- ===== 4. signatures: captured signature PNGs =====

create table if not exists public.signatures (
  id             uuid primary key default uuid_generate_v4(),
  -- Polymorphic anchor — usually 'payment_schedule' (invoice signature
  -- at acceptance) or 'payment_milestone' (on-payment signature).
  -- Quote signatures already live on `quotes.signed_at` so we don't
  -- duplicate those here.
  entity_type    text not null,
  entity_id      uuid not null,
  signer_name    text not null,
  -- Image/png data URL (typically ~20-50 KB). Stored inline so there's
  -- no storage-bucket dance to print a signed receipt.
  png_data_url   text not null,
  captured_at    timestamptz not null default now(),
  captured_ip    text,
  captured_user_agent text,
  created_at     timestamptz not null default now()
);
create index if not exists signatures_entity_idx
  on public.signatures (entity_type, entity_id);

alter table public.signatures enable row level security;

-- Office + admin can read / write.
create policy "office reads signatures" on public.signatures
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes signatures" on public.signatures
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
-- Anonymous inserts allowed via service-role writes from the public
-- pay page (createServiceRoleClient bypasses RLS). No public policy
-- needed.
