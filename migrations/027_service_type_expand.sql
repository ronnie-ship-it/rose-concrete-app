-- Rose Concrete — Expand the service_type enum
--
-- Migration 014 seeded the enum with the eight core types Ronnie was
-- quoting when we launched. This adds the gaps we&apos;ve seen on real
-- Jobber exports + the booking form: retaining walls, pool decks,
-- foundations, curbs, slabs, resurface work, demo, steps, and footings.
--
-- Postgres 12+ supports `add value if not exists` so each statement is
-- idempotent; values are appended to the end of the enum order so
-- existing rows keep their storage representation.
--
-- Run in Supabase SQL editor. Cannot run inside a transaction block with
-- other DDL, so this migration is ONLY the enum additions.

alter type service_type add value if not exists 'retaining_wall';
alter type service_type add value if not exists 'pool_deck';
alter type service_type add value if not exists 'foundation';
alter type service_type add value if not exists 'curb_and_gutter';
alter type service_type add value if not exists 'slab';
alter type service_type add value if not exists 'resurface';
alter type service_type add value if not exists 'demo';
alter type service_type add value if not exists 'steps';
alter type service_type add value if not exists 'footings';
alter type service_type add value if not exists 'walkway';
alter type service_type add value if not exists 'fence_post_footings';
