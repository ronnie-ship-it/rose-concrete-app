-- Rose Concrete — Payment schedules, reminders, and QBO receipt auto-send
--
-- Ronnie pours concrete; the computer tracks what's owed, nags the client,
-- and emails the receipt. The app NEVER moves money — QuickBooks is the
-- book of record for all payments. Everything here is either a pointer to a
-- QBO invoice/payment or a reminder/receipt send log.
--
-- Backs BACKLOG.md items #1 (payment schedules), #2 (reminders), #3 (QBO
-- receipt auto-send). All three share these tables so the reminder and
-- receipt workers just read `payment_milestones`.
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- ===== payment_schedules =====
-- One schedule per project. A project CAN exist without a schedule (leads,
-- quoting) — the schedule gets auto-seeded when the project flips to
-- 'approved' using the quote's deposit %.
create type payment_schedule_status as enum (
  'draft', 'active', 'completed', 'cancelled'
);

create table if not exists public.payment_schedules (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  total_amount        numeric(12, 2) not null,
  status              payment_schedule_status not null default 'draft',
  qbo_invoice_id      text,        -- the QBO invoice this schedule rolls up to
  qbo_invoice_number  text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (project_id)
);
create index if not exists payment_schedules_project_idx
  on public.payment_schedules (project_id);
create index if not exists payment_schedules_qbo_invoice_idx
  on public.payment_schedules (qbo_invoice_id)
  where qbo_invoice_id is not null;
create trigger payment_schedules_updated_at before update on public.payment_schedules
  for each row execute function set_updated_at();

-- ===== payment_milestones =====
-- Individual line items within a schedule. Status is driven by the QBO
-- reconcile cron, not by the UI — a manual "mark paid" button still writes
-- through to QBO first.
create type payment_milestone_status as enum (
  'pending',    -- not yet due, no reminder sent
  'due',        -- due_date is today or imminent
  'overdue',    -- past due_date, unpaid
  'paid',       -- QBO confirms payment received
  'waived',     -- manually waived by admin
  'refunded'    -- edge case: deposit refund despite non-refundable policy
);

create type payment_milestone_kind as enum (
  'deposit',    -- non-refundable by default per Ronnie's policy
  'progress',   -- mid-pour / material delivery / etc.
  'final',      -- balance due on completion
  'custom'
);

create table if not exists public.payment_milestones (
  id                uuid primary key default uuid_generate_v4(),
  schedule_id       uuid not null references public.payment_schedules(id) on delete cascade,
  sequence          int not null,            -- order within the schedule, 1-based
  kind              payment_milestone_kind not null default 'custom',
  label             text not null,           -- "50% deposit", "Balance on completion"
  amount            numeric(12, 2) not null,
  due_date          date,                    -- null = "due on completion" (no fixed date)
  status            payment_milestone_status not null default 'pending',

  -- QBO linkage — populated by the reconcile cron
  qbo_payment_id    text,
  qbo_paid_amount   numeric(12, 2),
  qbo_paid_at       timestamptz,

  -- Receipt auto-send workflow (BACKLOG #3)
  receipt_pending   boolean not null default false,
  receipt_sent_at   timestamptz,

  -- Reminder control (BACKLOG #2) — per-milestone so admin can pause one
  -- milestone's reminders without killing the whole schedule.
  reminders_paused  boolean not null default false,
  reminder_notes    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (schedule_id, sequence)
);
create index if not exists payment_milestones_schedule_idx
  on public.payment_milestones (schedule_id);
create index if not exists payment_milestones_status_idx
  on public.payment_milestones (status);
-- Hot-path index for the reminder cron: "everything due in the next 10 days
-- that isn't paid/waived and isn't paused."
create index if not exists payment_milestones_due_idx
  on public.payment_milestones (due_date)
  where status in ('pending', 'due', 'overdue') and reminders_paused = false;
-- Hot-path index for the receipt worker.
create index if not exists payment_milestones_receipt_pending_idx
  on public.payment_milestones (receipt_pending)
  where receipt_pending = true;
create trigger payment_milestones_updated_at before update on public.payment_milestones
  for each row execute function set_updated_at();

-- ===== payment_reminders =====
-- One row per (milestone, channel, scheduled_for). Unique index prevents a
-- misfiring cron from double-sending — the worker uses ON CONFLICT DO NOTHING
-- to claim a send slot.
create type reminder_channel as enum ('email', 'sms');
create type reminder_status  as enum ('scheduled', 'sent', 'failed', 'skipped');

create table if not exists public.payment_reminders (
  id             uuid primary key default uuid_generate_v4(),
  milestone_id   uuid not null references public.payment_milestones(id) on delete cascade,
  channel        reminder_channel not null,
  offset_days    int not null,              -- e.g. -3, 0, +3, +7 relative to due_date
  scheduled_for  timestamptz not null,
  status         reminder_status not null default 'scheduled',
  sent_at        timestamptz,
  error          text,
  message_id     text,                      -- Gmail draft/message id or OpenPhone message id
  created_at     timestamptz not null default now(),
  unique (milestone_id, channel, offset_days)
);
create index if not exists payment_reminders_due_idx
  on public.payment_reminders (scheduled_for)
  where status = 'scheduled';

-- ===== payment_receipt_sends =====
-- Audit log for the QBO receipt auto-send worker. One row per attempted send
-- (even failures) so we can answer "did we send the Johnson receipt?" in one
-- query. Unique on (milestone_id, qbo_payment_id) so the worker is idempotent
-- even if QBO sends duplicate webhooks.
create type receipt_send_status as enum ('pending', 'sent', 'failed');

create table if not exists public.payment_receipt_sends (
  id              uuid primary key default uuid_generate_v4(),
  milestone_id    uuid not null references public.payment_milestones(id) on delete cascade,
  qbo_payment_id  text not null,
  to_email        text not null,
  subject         text,
  status          receipt_send_status not null default 'pending',
  sent_at         timestamptz,
  gmail_message_id text,
  error           text,
  created_at      timestamptz not null default now(),
  unique (milestone_id, qbo_payment_id)
);
create index if not exists payment_receipt_sends_status_idx
  on public.payment_receipt_sends (status);

-- ===== Feature flags =====
insert into public.feature_flags (key, enabled) values
  ('payment_schedules',      false),
  ('payment_reminders',      false),
  ('qbo_receipt_auto_send',  false)
on conflict (key) do nothing;

-- ===== RLS =====
alter table public.payment_schedules     enable row level security;
alter table public.payment_milestones    enable row level security;
alter table public.payment_reminders     enable row level security;
alter table public.payment_receipt_sends enable row level security;

-- Office + admin can read/write payment data. Crew cannot see money.
create policy "office reads payment schedules" on public.payment_schedules
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes payment schedules" on public.payment_schedules
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "office reads payment milestones" on public.payment_milestones
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes payment milestones" on public.payment_milestones
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "office reads reminders" on public.payment_reminders
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes reminders" on public.payment_reminders
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );

create policy "office reads receipt sends" on public.payment_receipt_sends
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
create policy "office writes receipt sends" on public.payment_receipt_sends
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'office'))
  );
