-- Rose Concrete — Receipt auto-send settings
--
-- Tacks three columns onto the invoice_settings singleton so the receipt
-- worker (BACKLOG #3) has a sender address, a subject template, and a body
-- template without introducing a second settings table. Templates use
-- simple `{{placeholder}}` substitution — see lib/receipt-templates.ts.
--
-- Run in Supabase SQL editor.

alter table public.invoice_settings
  add column if not exists receipt_sender_email text not null default 'ronnie@sandiegoconcrete.ai',
  add column if not exists receipt_subject_template text not null
    default 'Receipt for {{milestone_label}} — {{project_name}}',
  add column if not exists receipt_body_template text not null
    default E'Hi {{client_name}},\n\nThanks for your payment of {{amount}} toward {{milestone_label}} on {{project_name}}. A receipt from QuickBooks is attached.\n\nIf you have any questions, just reply to this email.\n\n— Ronnie, Rose Concrete';
