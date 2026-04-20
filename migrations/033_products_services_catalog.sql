-- Rose Concrete — Products & Services catalog (Jobber parity)
--
-- Extends `line_item_templates` with the extra fields Jobber's
-- "Products & Services" page carries:
--   * category       — groups the catalog (Demolition, Driveway, etc.)
--   * is_taxable     — default taxable flag for new line items
--   * cost           — internal cost; drives the job-profitability margin
--   * photo_id       — default product photo, copied onto inserted lines
--
-- Additive / idempotent. Existing templates default to category='General',
-- is_taxable=true, cost=0.

alter table public.line_item_templates
  add column if not exists category text not null default 'General',
  add column if not exists is_taxable boolean not null default true,
  add column if not exists cost numeric(12, 2),
  add column if not exists photo_id uuid references public.photos(id) on delete set null;

create index if not exists line_item_templates_category_idx
  on public.line_item_templates (category, sort_order);
