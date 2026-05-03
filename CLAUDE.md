# Rose Concrete app — Claude session guide

This file is read by Claude at the start of every session. It captures
the operating rules so I don't have to be reminded each time.

---

## Always push at the end of a session

**Before you finish replying to the user with a "done" / summary,
ALWAYS run the ship script — even if the user didn't explicitly ask.**

```bash
npm run ship
```

That script is in `scripts/ship.mjs`. It:

1. Runs `git add -A` to stage every change in the working tree.
2. Builds a commit message from the change set (counts of new /
   changed / deleted, top-level directory hint).
3. Runs `git commit -F` with that message.
4. Runs `git push` to `origin/main`.

If the user provided a specific commit message intent, pass it via
`npm run ship -- --message "..."`.

If there's nothing to commit, the script exits cleanly — safe to
re-run as the last step of every turn that touched files.

**Never end a session with uncommitted changes.** Vercel auto-deploys
from main, so anything not pushed isn't live.

---

## Always typecheck before shipping

```bash
./node_modules/.bin/tsc --noEmit
```

Exit code 0 = clean. If there are errors, **fix them before pushing**
— a broken build on Vercel is worse than a missing feature.

---

## Always run migrations the same way

```bash
npm run migrate           # apply any new SQL files
npm run migrate:status    # show what's applied vs. pending
```

Never paste SQL into the Supabase dashboard — every migration must
be a file in `migrations/NNN_description.sql` so the run is
reproducible. The runner is in `scripts/migrate.js` and tracks
applied migrations in the `migrations_log` table.

---

## Conventions

- **Crew app** = `/crew/*` routes, mobile-first.
- **Office app** = `/dashboard/*` routes, desktop-first.
- **Visual identity comes from sandiegoconcrete.ai, not from Jobber.**
  Match Jobber's *structural* patterns (nav, list-detail flow, status
  pills, create speed-dial, trade-standard terminology) — never its
  visual treatments (palette, illustrations, brand mark).
- **Brand tokens** live in `app/styles/tokens.css` after PR-G.
  Until then, the canonical hex values are documented in
  `docs/refactor/phase-2-foundation-brief.md` §1. Never hardcode
  hex anywhere in `app/crew/**` going forward.
  - `--brand-900: #1b2a4a` (deep navy — primary CTAs, headlines)
  - `--accent-500: #2abfbf` (teal — secondary CTAs, links, focus)
  - `--cream-300: #f5efe0` (warm surface accent)
  - `--bg: #fafafa`, `--surface: #ffffff`, `--text: #171717`
- Any remaining `#1A7B40` / `#1a2332` / other hardcoded hex in
  `app/crew/**` is a migration target in PR-G/PR-H — leave alone
  outside those PRs.
- **Service worker** at `public/sw.js` uses **network-first** for
  `/crew/*` so deploys land instantly. Bump `CACHE_VERSION` whenever
  you ship a structural crew UI change.

---

## Files / locations to know

- `BACKLOG.md` — project queue + per-round wake-up notes. Always
  prepend a new wake-up note at the top before pushing.
- `scripts/ship.mjs` — auto-commit-and-push helper.
- `scripts/migrate.js` — autonomous Postgres migration runner.
- `lib/auth.ts` — `requireRole(["crew", "admin", "office"])` is the
  standard guard for crew pages.
- `lib/supabase/server.ts` (RLS) and `lib/supabase/service.ts`
  (service-role, used in server actions). Never use the service-role
  client from a route that doesn't gate on a role check.

---

## Workflow at the end of every session

```
1. typecheck    → ./node_modules/.bin/tsc --noEmit
2. migrate      → npm run migrate              (only if SQL files changed)
3. update BACKLOG.md  (prepend a wake-up note for the next session)
4. ship         → npm run ship
```

Always do step 4. Don't ask. The user expects every session to end
with a clean push.

**Exception — refactor PRs:** see "Refactor workflow" below. Refactor
PRs land on a feature branch with a draft PR for review, NOT through
`npm run ship`.

---

## Refactor workflow (PRs A–Z, scoped in `docs/refactor/`)

The crew-app refactor is broken into ~26 PRs across three phases.
Refactor work uses a different workflow than the default ship-to-main
flow above.

**When the work IS refactor work** (anything in the briefs below):

1. Start a feature branch named `refactor/pr-{letter}-{short-name}`
   (e.g. `refactor/pr-a-timezone-fix`).
2. Read the relevant brief section before writing code.
3. Confirm current state via grep / file reads. Report findings to
   the user before changing code.
4. Propose the diff. Wait for user approval.
5. Apply the diff. Run `next build` and `next lint`.
6. Open a draft PR titled exactly as the brief: `PR-{letter} —
   {brief title}`. Description copies the brief's
   Symptom / Root cause / Fix / Acceptance criteria sections verbatim.
7. **Do NOT merge to main yourself.** User reviews, then merges.

**When the work is default work** (marketing, content, docs, fixes
outside the refactor brief): use `npm run ship` to commit and push to
main, same as before. Confirmation isn't required for this path.

**One refactor PR = one concern.** Don't bundle multiple PRs together
even if they look related. The brief PR list defines the units.

### Refactor hard rules

These apply to every refactor PR (A–Z).

1. **Never link from `app/crew/**` to `/dashboard/*`.** A pre-commit
   grep should fail any PR that does. If a destination doesn't exist
   on the crew side, scaffold the crew route — don't punt to dashboard.
2. **Dates use `lib/date.ts` `todayInBusinessTZ()` / `nowInBusinessTZ()`**
   (created in PR-A). Never `new Date()` in JSX. Business TZ is
   `America/Los_Angeles`.
3. **Terminology — UI strings only for now:** Job (not Project),
   Visit (not Schedule entry), Request (not Lead), Quote (not
   Estimate). Glossary lives at `lib/copy/glossary.ts` after PR-K.
   **DB tables, route paths, and TypeScript types are NOT renamed in
   Phase 1 or 2.** That's a deferred migration tracked separately.
4. **Validation errors render in the UI.** Never push errors to the
   URL query string.
5. **Soft-delete only.** Use `deleted_at timestamptz`; never hard-
   delete user data.
6. **No "COMING SOON" stubs that mutate state on tap.** If a feature
   isn't built, the tap is a no-op preview or a clearly-labeled
   deeplink — not a server-side insert.
7. **One refactor PR = one concern.** Don't bundle.

### Refactor source documents

- `docs/refactor/phase-1-fix-brief.md` — 6 PRs (Sev 1 bugs)
- `docs/refactor/phase-2-foundation-brief.md` — 6 PRs (tokens, nav, glossary, hydration)
- `docs/refactor/phase-3-screen-specs.md` — 14 PRs (every screen)
- `docs/refactor/crew-app-audit.md` — original audit (Apr 26)
- `docs/refactor/jobber-deep-ui-audit.md` — Jobber UI structural reference

---

## Known toolchain issues

Tracked here so they don't get rediscovered every session. Each entry
is one line — paste a follow-up PR link next to it when fixed.

- `next lint` removed in Next 16; package.json script still references it.
  Fix: replace with `eslint .` + add `eslint.config.mjs` (flat config) in
  a follow-up PR.
