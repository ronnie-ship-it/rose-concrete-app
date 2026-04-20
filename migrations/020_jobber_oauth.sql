-- Rose Concrete — Jobber OAuth 2.0 credentials + token storage
--
-- Single-row table (latest row wins). Ronnie enters client_id +
-- client_secret from the Jobber Developer Center → the app redirects him
-- to Jobber to authorize → Jobber sends him back to our callback with a
-- code → the app exchanges code+id+secret for an access_token and
-- refresh_token, which are written back to this row. The access_token
-- expires after ~60 minutes; the refresh_token is used to mint new ones
-- until Ronnie revokes the app in Jobber.
--
-- Storage is plaintext for now. Acceptable because the row is behind RLS
-- (admin-only) and Supabase encrypts at rest. If we ever expose the app
-- to other orgs we'll move to a proper secret store.
--
-- Run in Supabase SQL editor after 019.

create table if not exists public.jobber_oauth_tokens (
  id                 uuid primary key default uuid_generate_v4(),
  client_id          text not null,
  client_secret      text not null,
  access_token       text,
  refresh_token      text,
  access_expires_at  timestamptz,
  account_name       text,
  -- When we start the OAuth dance we stash a one-time state string here;
  -- the callback validates it before exchanging the code. Prevents CSRF.
  pending_state      text,
  last_error         text,
  -- Resumable import progress — the runner stores the clients-edge cursor
  -- here so it survives page reloads and function timeouts.
  import_cursor      text,
  import_started_at  timestamptz,
  import_finished_at timestamptz,
  clients_processed  int not null default 0,
  notes_imported     int not null default 0,
  attachments_imported int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger jobber_oauth_tokens_updated_at
  before update on public.jobber_oauth_tokens
  for each row execute function set_updated_at();

alter table public.jobber_oauth_tokens enable row level security;

do $$ begin
  create policy "admin only jobber_oauth_tokens"
    on public.jobber_oauth_tokens for all
    using (public.is_admin());
exception when duplicate_object then null; end $$;
