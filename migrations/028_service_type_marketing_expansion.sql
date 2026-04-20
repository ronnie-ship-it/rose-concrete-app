-- Rose Concrete — service_type enum expansion for the marketing site
--
-- Migration 027 covered the day-to-day operational types (walkway, retaining
-- wall, pool deck, foundation, etc). The marketing site adds public-facing
-- categories that map to the new landing pages:
--
--   * exposed_aggregate, paving, drainage          - service pages
--   * driveway_extension, driveway_apron           - driveway micro-services
--   * commercial_flatwork                          - commercial landing page
--   * safe_sidewalks_program                       - flagship landing page
--
-- Together these let leads coming in through /api/leads carry an accurate
-- typed service_type so reports and workflow auto-seeding (mig 017) work.
-- Anything not in this list still falls back to 'other'.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent. Each statement runs
-- in its own implicit transaction; do NOT wrap these in BEGIN/COMMIT or
-- you can't use the new values in the same transaction (Postgres limitation).
--
-- Run in the Supabase SQL editor, after 027.
--
-- Companion change: lib/service-types.ts must list these in SERVICE_TYPES
-- and SERVICE_LABEL or the validator will reject them and the dropdown
-- will hide them. Done in the same change as this migration.

alter type service_type add value if not exists 'exposed_aggregate';
alter type service_type add value if not exists 'paving';
alter type service_type add value if not exists 'drainage';
alter type service_type add value if not exists 'driveway_extension';
alter type service_type add value if not exists 'driveway_apron';
alter type service_type add value if not exists 'commercial_flatwork';
alter type service_type add value if not exists 'safe_sidewalks_program';
