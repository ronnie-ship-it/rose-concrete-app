-- Rose Concrete — Saved line-item library
--
-- One-tap insert of Ronnie's standard line items ("4\" driveway pour",
-- "stamped upcharge", etc.) into a quote. Biggest single "Ronnie is
-- faster" win — every competitor has this, we didn't.
--
-- Run in Supabase SQL editor.

create table if not exists public.line_item_templates (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text,
  unit          text not null default 'job',
  unit_price    numeric(12, 2) not null default 0,
  default_quantity numeric(10, 2) not null default 1,
  is_active     boolean not null default true,
  sort_order    int not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists line_item_templates_active_idx
  on public.line_item_templates (is_active, sort_order);
create trigger line_item_templates_updated_at
  before update on public.line_item_templates
  for each row execute function set_updated_at();

alter table public.line_item_templates enable row level security;

create policy "admin office full access line item templates"
  on public.line_item_templates for all using (public.is_office_or_admin());
