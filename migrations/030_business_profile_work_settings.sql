-- Rose Concrete — Business Profile + Work Settings (Jobber parity)
--
-- Covers two Settings sidebar items from the Jobber audit:
--   * Business Profile — name, phone, website, email, logo, client-hub
--     bio, business hours, public-listing opt-in.
--   * Work Settings — default visit duration, working hours, first day
--     of week, default buffer between visits.
--
-- Both stored as singletons keyed on `singleton=true` (matches the
-- pattern already used by `invoice_settings`). Additive / idempotent.

-- ===== Business Profile =====
create table if not exists public.business_profile (
  singleton          boolean primary key default true,
  company_name       text not null default 'Rose Concrete',
  legal_name         text,
  tagline            text,
  bio                text,                                -- shown on client hub
  phone              text,
  email              text,
  website            text,
  address_line_1     text,
  address_line_2     text,
  city               text,
  state              text default 'CA',
  postal_code        text,
  license_number     text,
  logo_storage_key   text,                                -- path in `attachments` Storage
  public_listing     boolean not null default true,       -- "help clients find my business"
  keep_address_private boolean not null default false,
  hours              jsonb not null default $${
    "sun": {"open": null, "close": null},
    "mon": {"open": "09:00", "close": "17:00"},
    "tue": {"open": "09:00", "close": "17:00"},
    "wed": {"open": "09:00", "close": "17:00"},
    "thu": {"open": "09:00", "close": "17:00"},
    "fri": {"open": "09:00", "close": "17:00"},
    "sat": {"open": null, "close": null}
  }$$::jsonb,
  updated_at         timestamptz not null default now(),
  constraint business_profile_singleton check (singleton = true)
);

insert into public.business_profile (singleton) values (true)
on conflict (singleton) do nothing;

create trigger business_profile_updated_at before update on public.business_profile
  for each row execute function set_updated_at();

alter table public.business_profile enable row level security;

do $$ begin
  create policy "authenticated read business_profile"
    on public.business_profile for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write business_profile"
    on public.business_profile for all using (public.is_admin())
    with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- ===== Work Settings =====
create table if not exists public.work_settings (
  singleton               boolean primary key default true,
  default_visit_min       int not null default 60,       -- default new-visit duration
  buffer_between_min      int not null default 15,       -- gap between visits
  working_hours           jsonb not null default $${
    "sun": {"start": null, "end": null},
    "mon": {"start": "07:00", "end": "17:00"},
    "tue": {"start": "07:00", "end": "17:00"},
    "wed": {"start": "07:00", "end": "17:00"},
    "thu": {"start": "07:00", "end": "17:00"},
    "fri": {"start": "07:00", "end": "17:00"},
    "sat": {"start": null, "end": null}
  }$$::jsonb,
  first_day_of_week       smallint not null default 1,    -- 0=Sun, 1=Mon
  timezone                text not null default 'America/Los_Angeles',
  updated_at              timestamptz not null default now(),
  constraint work_settings_singleton check (singleton = true)
);

insert into public.work_settings (singleton) values (true)
on conflict (singleton) do nothing;

create trigger work_settings_updated_at before update on public.work_settings
  for each row execute function set_updated_at();

alter table public.work_settings enable row level security;

do $$ begin
  create policy "authenticated read work_settings"
    on public.work_settings for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin write work_settings"
    on public.work_settings for all using (public.is_admin())
    with check (public.is_admin());
exception when duplicate_object then null; end $$;
