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

- **Crew app** = `/crew/*` routes, mobile-first, designed to mirror
  Jobber's iOS app pixel-for-pixel.
- **Office app** = `/dashboard/*` routes, desktop-first, designed to
  mirror Jobber's web app.
- **Primary green** is `#1A7B40` (Jobber's saturated forest green).
  Don't use `#4A7C59` — that was the old sage value, replaced in
  round 20.
- **Dark navy** for cards & dark text is `#1a2332`.
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
