# Crew App Rebuild Brief — "Jobber mobile, not Jobber.com"

**Date:** 2026-07-05 · **Author:** Cowork (planning) · **Implementer:** Claude Code
**Decision (Ronnie, 2026-07-05):** Jobber stays the system of record for scheduling.
The crew app reads the Jobber schedule and captures field activity (photos, status,
notes). Goal is continuity: crew is trained on the Jobber phone app, so screens must
follow the patterns in `docs/refactor/jobber-mobile-ui-audit.md` (built from Ronnie's
screenshots), NOT the getjobber.com website look the current crew screens drifted into.

## What we keep

- The repo, auth (`lib/auth.ts` requireRole), Supabase schema, brand tokens.
- `lib/jobber-api.ts` — `getValidJobberAccessToken()` + client search already work.
- `docs/refactor/jobber-mobile-ui-audit.md` (+ day2) — the visual/structural spec.
- `docs/refactor/phase-3-screen-specs.md` — screen inventory (revise per mobile audit).
- Existing `/crew` scaffolding — rebuilt in place, not thrown away.

## What we drop

- The 26-PR refactor grind as a program. Cherry-pick only what serves the four
  phases below. Archive the rest of the queue in BACKLOG.md.
- Clock In / Timesheet (per Ronnie): the Timesheet bottom-nav slot becomes
  "Tasks to schedule".
- Any crew-side quoting/invoicing. Office keeps that; crew never sees it.

## Phase 1 — Jobber → app schedule sync (build first)

1. New sync module `lib/jobber-sync.ts`: pull visits + jobs + client names/addresses
   from the Jobber GraphQL API (visits for today ± 14 days), map into Supabase
   (`projects`/`visits` mirror tables or `jobber_*` mirror tables — implementer's
   call, document it). One-way: Jobber wins on schedule fields, app owns field data
   (photos, notes, status updates).
2. Cron route `app/api/cron/jobber-sync/route.ts` (every 15 min, guard with
   `lib/cron-auth.ts`) + manual "pull to refresh" server action for crew.
3. Idempotent upserts keyed on Jobber IDs. Soft-delete visits that disappear
   from Jobber (`deleted_at`, never hard-delete).
4. Acceptance: change a visit time in Jobber → appears in the app within 15 min;
   crew data survives re-sync untouched.

## Phase 2 — Crew screens to Jobber-mobile patterns

Follow `jobber-mobile-ui-audit.md` sections exactly:

- §1 Global chrome: 5-item bottom nav (Home, Schedule, +FAB, Tasks to schedule,
  More), per-screen headers, modal sheets for sub-actions.
- §2 Home: today's visit cards (time, client, address, status pill), tap = detail.
- §3 Job detail: full-screen, sectioned (schedule block, address w/ map link,
  notes, photos, status actions). No desktop tables, no sidebar layouts.
- Status actions: On My Way / Start / Complete as large tap targets (reuse
  existing on-my-way / mark-done actions, restyled).
- Rules: brand tokens only (no hardcoded hex), `todayInBusinessTZ()` for all dates,
  glossary terms (Job/Visit/Request/Quote), never link crew → /dashboard,
  validation errors in-UI, no state-mutating stubs. Bump `CACHE_VERSION` in
  `public/sw.js` on ship.

## Phase 3 — Photos that survive job sites

1. Upload from job detail: camera or gallery, multiple at once.
2. Offline/one-bar resilience: queue uploads in IndexedDB, retry with backoff,
   visible per-photo state (queued / uploading / done / failed + retry button).
   Never lose a photo silently — this is the trust-killer.
3. Store in Supabase storage under the project, surface in the office dashboard
   project view (and lead/job timeline).
4. Acceptance: airplane-mode a phone, take 3 photos, re-enable data → all 3 land.

## Phase 4 — Field trial

Two weeks, Roger + crew run this app in parallel with Jobber. Ronnie keeps
scheduling in Jobber. Fix what breaks; only then talk about dropping crew seats.

## Workflow

Feature branch per phase (`crew-rebuild/phase-1-sync` etc.), draft PR, Ronnie
reviews and merges. `tsc --noEmit` + `next build` clean before every PR.
Prepend a BACKLOG.md wake-up note per phase.
