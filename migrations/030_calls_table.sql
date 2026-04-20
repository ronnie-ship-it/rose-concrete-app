-- Rose Concrete — call tracking scaffold
--
-- Schema for inbound call attribution. The /api/calls/inbound endpoint
-- (stub today) will receive webhook posts from a call-tracking provider
-- (CallRail, OpenPhone webhook, etc.) and write rows here.
--
-- Today this is unwired — no provider is sending webhooks yet. The
-- table + endpoint exist so when Ronnie picks a provider, integration
-- is one more PR rather than starting from scratch.
--
-- Run in the Supabase SQL editor, after 029.

do $$ begin
  create type call_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_status as enum (
    'completed',
    'missed',
    'voicemail',
    'busy',
    'no_answer',
    'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.calls (
  id                  uuid primary key default uuid_generate_v4(),
  external_id         text unique,                 -- provider's call ID
  direction           call_direction not null,
  caller_phone        text not null,
  called_phone        text,                        -- which Rose number was dialed
  -- Marketing attribution: which page was the visitor on when they
  -- clicked the click-to-call link, if known. Set by the provider's
  -- per-page tracking number, or via a session cookie hand-off.
  source_page         text,
  duration_s          int,
  recording_url       text,
  transcript          text,
  status              call_status,
  client_id           uuid references public.clients(id) on delete set null,
  raw_payload         jsonb default '{}'::jsonb,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists calls_caller_phone_idx on public.calls (caller_phone);
create index if not exists calls_source_page_idx on public.calls (source_page);
create index if not exists calls_started_at_idx  on public.calls (started_at desc);
create index if not exists calls_client_idx      on public.calls (client_id);

alter table public.calls enable row level security;
create policy "admin office full access calls"
  on public.calls for all using (public.is_office_or_admin());
