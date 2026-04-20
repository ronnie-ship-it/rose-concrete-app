-- Rose Concrete — editable email + SMS message templates
--
-- Jobber lets the user customize every templated message the system sends
-- (quote sent, appointment reminder, invoice sent, review request, etc.)
-- with merge tokens. This gives us the same knob.
--
-- Schema:
--   * `message_templates` is a small CRUD table keyed on `slug` (the
--     stable identifier the code looks up; e.g. 'quote_sent',
--     'visit_reminder_24h', 'review_request'). Each template has an
--     `email_subject`, `email_body`, `sms_body`, plus toggles.
--   * Merge tokens are plain `{client_name}` style — helpers in
--     `lib/templates.ts` render them. Admins see a token reference on
--     the settings page.
--
-- Seed rows insert a sensible default for every well-known slug so
-- turning on the feature doesn't require a round of data entry first.

create table if not exists public.message_templates (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  label          text not null,
  description    text,
  email_subject  text,
  email_body     text,
  sms_body       text,
  send_email     boolean not null default true,
  send_sms       boolean not null default true,
  is_active      boolean not null default true,
  updated_at     timestamptz not null default now()
);
create trigger message_templates_updated_at before update on public.message_templates
  for each row execute function set_updated_at();

alter table public.message_templates enable row level security;
do $$ begin
  create policy "admin office read message_templates"
    on public.message_templates for select using (public.is_office_or_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write message_templates"
    on public.message_templates for all using (public.is_admin())
    with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- Seed the defaults. Upsert-ish: skip rows that already exist.
insert into public.message_templates (slug, label, description, email_subject, email_body, sms_body)
select * from (values
  (
    'quote_sent',
    'Quote sent',
    'Fires when a quote is sent to the customer.',
    'Your Rose Concrete quote #{quote_number}',
    E'Hi {first_name},\n\nThanks for the opportunity to quote {project_name}. You can review and approve online:\n\n{quote_url}\n\nReply here with any questions.\n\n— Ronnie\nRose Concrete · San Diego',
    E'Hi {first_name} — your Rose Concrete quote for {project_name} is ready: {quote_url}. Reply with any questions. — Ronnie'
  ),
  (
    'quote_approved',
    'Quote approved (customer-facing)',
    'Confirmation the moment a quote is accepted online.',
    'Thanks — we got your approval',
    E'Hi {first_name},\n\nThanks for approving the quote for {project_name}. We''ll text you with scheduling details shortly.\n\n— Ronnie',
    E'Hi {first_name} — got your approval for {project_name}. We''ll text to schedule. — Ronnie'
  ),
  (
    'visit_reminder_24h',
    'Visit reminder (24h)',
    'Fires 24 hours before a scheduled visit.',
    'Heads up: Rose Concrete visit tomorrow',
    E'Hi {first_name},\n\nQuick reminder — we''re scheduled at {service_address} on {visit_time}. Reply here if anything''s changed.\n\n— Ronnie',
    E'Rose Concrete — {first_name}, just a heads up we''re scheduled at {service_address} on {visit_time}. Reply if anything changes.'
  ),
  (
    'visit_reminder_1h',
    'Visit reminder (1 hour)',
    'Fires 1 hour before a scheduled visit.',
    null,
    null,
    E'Rose Concrete — {first_name}, we''re on our way. ETA about 1 hour to {service_address}.'
  ),
  (
    'payment_due_reminder',
    'Payment due reminder',
    'Fires on the due date for a payment milestone.',
    'Payment due today: {milestone_label}',
    E'Hi {first_name},\n\n{milestone_label} for {project_name} ({amount}) is due today. Pay here:\n\n{pay_url}\n\nThanks — Ronnie',
    E'Rose Concrete: {milestone_label} ({amount}) for {project_name} is due today. Pay: {pay_url}'
  ),
  (
    'review_request',
    'Google review request',
    'Fires 3 days after a job is marked done and the final milestone is paid.',
    'Mind leaving a quick Google review?',
    E'Hi {first_name},\n\nThanks again for trusting us with {project_name}. If you''ve got a minute, a Google review goes a long way for a small business:\n\n{review_url}\n\n— Ronnie\nRose Concrete',
    E'Hi {first_name} — this is Ronnie. Mind leaving a quick Google review for Rose Concrete? {review_url}. Thanks!'
  ),
  (
    'on_my_way',
    'On-my-way text',
    'Sent from the visit detail "On my way" button.',
    null,
    null,
    E'Hi {first_name} — this is Ronnie with Rose Concrete. I''m headed your way now, ETA about {eta_minutes} minutes. Text back if anything changes.'
  ),
  (
    'booking_confirmation',
    'Booking confirmation',
    'Sent from the "Text booking confirmation" button on a job.',
    null,
    null,
    E'Hi {first_name} — this is Rose Concrete confirming {project_name}. We''ll see you {visit_time}. Reply with any questions. — Ronnie'
  )
) as v(slug, label, description, email_subject, email_body, sms_body)
where not exists (
  select 1 from public.message_templates t where t.slug = v.slug
);
