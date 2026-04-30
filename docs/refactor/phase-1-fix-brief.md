# Rose Concrete Crew App — Phase 1 Fix Brief

**Date:** 2026-04-29
**Repo:** `ronnie-ship-it/rose-concrete-app`
**Production:** `rose-concrete-app.vercel.app`
**Stack:** Next.js (App Router) PWA · Supabase backend · TypeScript (assumed) · Vercel hosting
**Source audit:** `crew-app-audit.md` (Apr 26, 2026)
**Scope of this brief:** the 5 Sev 1 ship-blocking bugs + demo-data cleanup. No styling work, no new features, no Sev 2/3 items — those come in later phases.

> **Conventions used below:** "Likely files" are educated guesses based on Next.js App Router conventions (`app/crew/...`, `app/api/...`, `lib/`, `components/`). Confirm the exact path against the repo before editing. Each bug ships as its own PR for clean rollback.

---

## Suggested PR order

1. **PR-A — Timezone fix.** Single small change, but it removes 3 visible defects and corrects every future-dated record. Land first so subsequent fixes work against correct dates.
2. **PR-B — Phantom quote template fix.** Stops active data corruption. Highest urgency after timezone.
3. **PR-C — Bell routing + Notifications stub.** Tiny.
4. **PR-D — Search default state.** Small UX fix.
5. **PR-E — Clock-in wired to a real time entry.** Largest of the five; touches DB.
6. **PR-F — Demo data scrub** (Supabase SQL, not code). Run after PR-A so timestamps are correct.

---

## PR-A — Timezone: stop generating tomorrow's dates today

### Symptom
- New Expense form's date input pre-fills `04/27/2026` when today is `04/26/2026`.
- New quotes created today are stamped `Quote #2026-0427-NNN` and the detail page shows `Issued Apr 27, 2026`.
- Same bug, three surfaces.

### Root cause hypothesis
Server is generating dates in UTC but the business operates in `America/Los_Angeles`. After ~5 PM PT (midnight UTC) the server's "today" is already tomorrow in LA. Every `new Date()` and any DB `now()` call inherits this.

### Files likely involved
- Anywhere a date is stamped without an explicit zone:
  - `app/crew/create/expense/**` — form default `date` value
  - `app/crew/create/quote/**` and `app/api/quotes/**` — quote ID generator + `issued_at`
  - `lib/date.ts` (if exists) or `lib/utils/date.ts`
  - DB triggers / default values on `quotes.issued_at`, `quotes.quote_number`
- `next.config.js` — confirm `TZ` env var is not set incorrectly
- Vercel project env vars — `TZ` should not be set; rely on explicit zone in code

### Fix approach
1. **Centralize "now in business TZ".** Create `lib/date.ts`:
   ```ts
   import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

   export const BUSINESS_TZ = 'America/Los_Angeles';

   /** Today's calendar date in the business timezone, as YYYY-MM-DD. */
   export function todayInBusinessTZ(): string {
     return formatInTimeZone(new Date(), BUSINESS_TZ, 'yyyy-MM-dd');
   }

   /** Now, as a Date, but anchored to the business-TZ wall clock. */
   export function nowInBusinessTZ(): Date {
     return toZonedTime(new Date(), BUSINESS_TZ);
   }
   ```
2. **Replace** every `new Date().toISOString().slice(0,10)` and similar pattern with `todayInBusinessTZ()`.
3. **Quote number generator** — change the `YYYY-MMDD` segment to use `todayInBusinessTZ()`.
4. **Forms** — Expense `<input type="date" defaultValue={todayInBusinessTZ()} />`.
5. **DB defaults** — if Supabase has a column default like `current_date`, replace with a Postgres-side timezone-aware default:
   ```sql
   ALTER TABLE expenses
     ALTER COLUMN expense_date
     SET DEFAULT (current_timestamp AT TIME ZONE 'America/Los_Angeles')::date;
   ```

### Acceptance criteria
- At 11:59 PM PT on day N, opening the new Expense form pre-fills day N (not N+1).
- A quote created at 11:59 PM PT on day N has number `YYYY-MMDD-NNN` matching day N and `Issued Apr N` in the detail.
- Server-render and client-render show the same date string (no hydration mismatch on dates).

### Test plan
- Set local clock to 11:55 PM PT, open Expense and Quote create. Verify date.
- Run the same test in `?test_now=` URL param if the repo supports a date-injectable clock; otherwise add one for E2E.

---

## PR-B — Quote templates create phantom $0.00 draft quotes

### Symptom
Tapping any template tile in `/crew/create/quote` (e.g. "Basic Sidewalk Repair for Small Job") returns the user to Home, shows a red toast saying the mobile builder isn't ready, **but inserts a Draft quote in the database** with $0.00 total, no line items, and an arbitrary client (KEN appeared without selection). The Home counter "X require invoicing jobs" climbed 14 → 17 → 21 in one session as templates were tapped.

### Root cause hypothesis
The template tile's tap handler is firing two things:
1. A "load template" action that creates a quote row server-side as a side effect.
2. A redirect to `/crew` with the toast.

The intended UX is "preview only / coming soon" but the create-side-effect was left in. Likely an `onClick` that does both `await createQuoteFromTemplate(...)` and `router.push('/crew')`.

### Files likely involved
- `app/crew/create/quote/page.tsx` — the template list
- `app/crew/create/quote/_components/TemplateTile.tsx` (or similar)
- `app/api/quotes/from-template/route.ts` — likely the bad endpoint
- `lib/quotes/createFromTemplate.ts`

### Fix approach
**Short-term (ship this PR):** make the tile a no-op preview until the mobile builder is real.
1. Replace the tile's tap handler with a route to a read-only template detail screen (`/crew/templates/[id]`) that shows the template's line items but does **not** call any create endpoint.
2. Add a single CTA on that detail screen: "Use the desktop app to send this quote" → `mailto:` or a copy-to-clipboard of the deep link to `/dashboard/quotes/new?template=xyz` for desktop sessions.
3. **Remove or feature-flag the `/api/quotes/from-template` endpoint until the mobile builder lands.** Wrap in `if (!FEATURE_MOBILE_QUOTE_BUILDER) return 410 Gone`.

**Mid-term (later phase):** ship the actual mobile quote builder so this endpoint becomes useful.

### Acceptance criteria
- Tapping any template tile does not insert a row into `quotes`.
- Home counter is stable across template taps.
- No phantom client assignments occur (existence of "KEN" on a quote you didn't pick KEN for is the canary — should never happen again).

### Test plan
- Pre-test: snapshot `select count(*) from quotes;` in Supabase.
- Tap each of the 6 templates twice.
- Post-test: row count unchanged.

### Cleanup migration (run once after PR-B ships)
Phantom quotes already exist in production. Identify and soft-delete them:
```sql
-- Likely signature of phantom quotes:
--   total = 0.00, no line items, status = 'draft', issued_at = today (off-by-one),
--   created via the from-template endpoint
SELECT id, quote_number, client_id, total, created_at
FROM quotes
WHERE total = 0
  AND status = 'draft'
  AND id NOT IN (SELECT DISTINCT quote_id FROM quote_line_items)
  AND created_at > '2026-04-15';
-- Review the list with Ronnie, then:
UPDATE quotes SET deleted_at = now() WHERE id IN (...);
```

---

## PR-C — Notification bell goes to wrong page

### Symptom
The bell icon in the crew header has a badge that increments (4 → 5 mid-session) and routes to `/crew/more` on tap. There is no notifications page anywhere in the crew app. Users are told they have unread alerts they can never read.

### Root cause hypothesis
Placeholder href left in during early build-out. The badge counter is wired to a real query but the destination was never built.

### Files likely involved
- `app/crew/_components/CrewHeader.tsx` (or `Header.tsx`)
- `lib/notifications/useUnreadCount.ts` (likely already exists since the badge has a number)

### Fix approach
1. Create `app/crew/notifications/page.tsx` — minimal viable screen:
   - Server component that queries the same source the badge counts.
   - List rows: title, body (truncated), relative time, deep-link to the relevant entity (quote, job, request).
   - Empty state: "You're all caught up."
   - Tapping a row marks-read on click and navigates to the deep link.
2. Update the bell `<Link>` href from `/crew/more` to `/crew/notifications`.
3. On the new page, decrement the badge on view (or on row-click — pick one and document).

### Acceptance criteria
- Bell tap opens `/crew/notifications`.
- Badge count matches the number of unread rows on that page.
- Tapping a row dismisses it from the unread list and lands on the linked entity.

### Out of scope for this PR
- Push notifications, email digests, in-app toast on new alert, marking-all-read. Those are later.

---

## PR-D — Default search returns recent feed instead of filtering

### Symptom
On `/crew/search`, typing "Linda" with no filter pill selected returns the same "Recently active" list (Hangar Showcase, Pickleball Court Showcase, etc.) — none of which contain "Linda". Filtering only works after a pill is tapped.

### Root cause hypothesis
The search input handler only feeds the typed query to per-pill subqueries. The default ("All") view falls through to a `recentlyActive()` query that ignores the query string.

### Files likely involved
- `app/crew/search/page.tsx`
- `app/crew/search/_components/SearchResults.tsx`
- `lib/search/searchAll.ts` (or similar)

### Fix approach
1. When no pill is selected and `query.length >= 2`, run a fan-out search across Clients, Requests, Quotes, and Jobs in parallel.
2. Merge results, label each row with its type pill, and rank by:
   - exact match on name first,
   - then `ilike '%query%'` rank,
   - then recency.
3. Cap to ~30 rows, with "View all in Clients / Quotes / Jobs / Requests" footer links to the type-filtered views.
4. When `query.length < 2` and no pill is selected → show the current "Recently active" feed (preserves the empty-state UX).

### Acceptance criteria
- Typing "Linda" with no pill selected returns Linda Rose rows.
- Recently-active still appears when the input is empty.
- Per-pill filtering still works as before (no regression).

### Test plan
- Search "Linda" → expect Linda Rose rows.
- Search "Quote 192" → expect Quote #192.
- Search "Forward" → expect 516 Forward St client/job (Federico Escobedo).
- Empty search → recently active feed.

---

## PR-E — Clock In actually clocks in

### Symptom
The big green "Clock In" CTA on `/crew` is just a `<Link href="/crew/schedule">`. It opens Schedule; it does not start a time entry; the Timesheet still shows 0m/No hours after pressing it. The "Total Completed Time 00:00" indicator on Home stays stuck.

### Root cause hypothesis
Time-tracking endpoint never wired up; Clock In was stubbed as a navigation link to make Home look complete.

### Files likely involved
- `app/crew/_components/HomeHero.tsx` or similar
- `app/api/time-entries/route.ts` — needs to exist (POST to start, POST to stop)
- `lib/time-tracking/` — server actions
- DB: confirm `time_entries` table exists (columns: `id`, `user_id`, `started_at`, `ended_at`, `job_id` nullable, `created_at`)

### Fix approach
1. **Create `time_entries` table** if it doesn't exist:
   ```sql
   create table time_entries (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id),
     job_id uuid references jobs(id),
     started_at timestamptz not null,
     ended_at timestamptz,
     created_at timestamptz default now() not null
   );
   create index on time_entries (user_id, started_at desc);
   create unique index one_open_entry_per_user
     on time_entries (user_id) where ended_at is null;
   ```
   (The unique partial index enforces "only one open clock-in per user".)
2. **Server action `clockIn` / `clockOut`** in `lib/time-tracking/actions.ts`:
   ```ts
   'use server';
   export async function clockIn(jobId?: string) {
     const supabase = createServerActionClient(...);
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error('Not signed in');
     const { error } = await supabase
       .from('time_entries')
       .insert({ user_id: user.id, started_at: new Date().toISOString(), job_id: jobId ?? null });
     if (error) throw error;
     revalidatePath('/crew');
     revalidatePath('/crew/timesheet');
   }
   export async function clockOut() {
     // update where ended_at is null for this user; set ended_at = now()
   }
   ```
3. **HomeHero component** — replace the `<Link>` with a `<form action={clockIn}>` button. When an entry is open, swap to "Clock Out (00:34:21)" with a live timer.
4. **Timesheet page** — sum durations per day from `time_entries`, render under each weekday row.
5. **Total Completed Time on Home** — sum today's entries.

### Acceptance criteria
- Tapping Clock In creates a `time_entries` row with `started_at = now()` and `ended_at = null`.
- The button label changes to "Clock Out" with a live counter.
- Tapping Clock Out closes the row (`ended_at = now()`).
- Timesheet shows the totals; Home's "Total Completed Time" reflects today.
- A user can't double-clock-in (the unique partial index returns 23505; surface a friendly error).

### Out of scope for this PR
- Per-job clock-in (just user-level for now), break tracking, edit/approval workflow, GPS stamping, payroll export. Those land later.

---

## PR-F — Demo data scrub (Supabase SQL, no code change)

### Symptom
Production has demo / test data leaking into search and lists:
- "Showcase" client and "(Unnamed client)"
- "Test Lead"
- "Report totals:" appearing as a row
- Linda Rose duplicated 3× with identical phone (5076181846) and email (`sample@nothing`)

### Approach
Soft-delete (don't hard-delete — keep an audit trail) by setting `deleted_at`.

```sql
-- 1. Showcase / placeholder rows
UPDATE clients SET deleted_at = now()
WHERE first_name in ('Showcase', '(Unnamed client)')
   OR last_name = 'Showcase'
   OR first_name ilike 'Hangar Showcase%'
   OR first_name ilike 'Pickleball Court Showcase%'
   OR first_name ilike 'Sidewalk Showcase%'
   OR first_name ilike 'Patio Showcase%'
   OR first_name ilike 'Walkway Showcase%'
   OR first_name ilike 'Driveway Showcase%';

-- 2. Test Lead
UPDATE clients SET deleted_at = now()
WHERE first_name = 'Test' AND last_name ilike 'Lead%';

-- 3. "Report totals:" — review row first; this looks like a data-import bug
SELECT * FROM clients WHERE first_name ilike 'Report totals%';
-- then UPDATE ... SET deleted_at = now() WHERE id IN (...);

-- 4. Linda Rose dedupe — keep oldest, soft-delete the rest, repoint any FK refs first
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY phone, email ORDER BY created_at ASC
  ) AS rn
  FROM clients
  WHERE first_name = 'Linda' AND last_name = 'Rose'
)
SELECT id, rn FROM ranked;  -- review

-- After review, repoint quotes/jobs/etc to the survivor, then:
-- UPDATE clients SET deleted_at = now() WHERE id IN (<dupes>);
```

### Acceptance criteria
- Search no longer returns Showcase/Test rows.
- Linda Rose appears once.
- No referential integrity broken (any quotes/jobs that pointed at the soft-deleted dupes are repointed at the survivor).

### Validation prerequisite
- Confirm `clients` table has a `deleted_at timestamptz` column. If not, add it before running these scripts:
  ```sql
  alter table clients add column if not exists deleted_at timestamptz;
  -- and confirm read paths filter on deleted_at IS NULL
  ```

---

## Cross-cutting follow-ups (NOT Sev 1, do not bundle into these PRs)

These came up while triaging Sev 1 and belong in Phase 2:
- React #418 hydration mismatch and `parentNode` null-deref. Probably caused by the timezone bug (server/client render different dates) — PR-A may resolve some occurrences. If errors persist after PR-A, root-cause separately.
- Two competing quote-numbering schemes (`#192` vs `2026-0427-298`) — pick one.
- "Project" vs "Job" naming — pick one and rename routes/copy.
- Validation messages rendered into URL query strings — refactor in Phase 2.

---

## Definition of done for Phase 1

All five PRs merged, deployed to `rose-concrete-app.vercel.app`, and verified by the smoke test below:

1. Open `/crew` after 11 PM PT — date on Expense form and any new quote ID matches today's PT date.
2. Open `/crew/create/quote`, tap each template — quote count in Supabase unchanged.
3. Tap the bell — lands on `/crew/notifications`.
4. Type "Linda" in `/crew/search` with no pill — Linda Rose rows show.
5. Tap "Clock In" on Home — button switches to "Clock Out" with counter; Timesheet reflects it.
6. Run `select count(*) from clients where first_name ilike 'Showcase%' and deleted_at is null;` — returns 0.

When all six pass, Phase 1 is done. Move to Phase 2.
