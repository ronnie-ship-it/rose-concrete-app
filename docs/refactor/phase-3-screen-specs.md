# Rose Concrete Crew App — Phase 3 Screen-by-Screen Specs

**Date:** 2026-04-29
**Repo:** `ronnie-ship-it/rose-concrete-app`
**Scope:** mobile-first specs for every crew screen, adapting the structural patterns documented in `jobber-deep-ui-audit.md` (web) into a native-feeling mobile experience. Visual identity is anchored to sandiegoconcrete.ai (Phase 2 tokens). Each spec is organized so a Claude Code session can pick a screen and ship it in isolation.

> **Reading order suggestion.** Read §0 (shared chrome) first — every screen depends on it. Then jump to whichever screen you're building. Each screen spec is self-contained.

---

## §0. Shared chrome (every crew screen)

### Header (`<CrewHeader>`)
- 56 px tall (`var(--header-h)`), full width, sticky top, BG `var(--surface)`, hairline `--border` at bottom.
- Layout: title (left, `--fs-lg --fw-semibold`), action group (right).
- Right-side actions, in order:
  1. **Notifications bell** — links to `/crew/notifications` (NOT `/crew/more`). Red dot if unread > 0; numeric badge if ≥ 1.
  2. **Profile avatar** — initials in a circle, `var(--accent-500)` BG. Tap → `/crew/profile`.
- No "AI/sparkle" icon. No hamburger. No global search inside the header (Search lives in the bottom nav).

### Bottom nav (`<CrewBottomNav>`)
- 64 px tall (`var(--bottomnav-h)`) + iOS safe-area inset.
- Five items (in order): **Home · Schedule · Timesheet · Search · More**.
- Each item: icon (24 px) over label (`--fs-xs --fw-medium`).
- Active item: icon and label `var(--brand-900)`; inactive: `var(--text-muted)`.
- Tap target: full column, ≥ `--touch-min`.

### Floating Action Button (`<CrewFab>`)
- 56×56 circle, `var(--accent-500)` BG, white plus icon.
- Bottom-right, `bottom: calc(var(--bottomnav-h) + 16px + var(--safe-bottom))`, `right: 16px`.
- Tap opens a speed-dial sheet with: **Visit · Time entry · Photo · Note · Client · Request · Quote · Job · Invoice · Expense · Task**.
  - Order is "most-used-by-crew first." Order is configurable in `lib/crew/fabActions.ts`.
- Sheet animation: slide up from bottom, dim backdrop, dismiss on backdrop tap or swipe down.

### List row (`<ListRow>`)
- Min-height 64 px (touch-friendly), padding `--space-3 --space-4`.
- Layout (left → right): leading visual (avatar / icon / 4 px status stripe) · primary text + secondary text stack · trailing meta (amount / time) · chevron.
- Border-bottom hairline; last row no border.
- Status stripe variants (4 px wide left edge): teal = info, green = success, amber = warning, red = danger.

### Status pill (`<StatusPill status="draft|sent|approved|rejected|overdue|active|done">`)
- Single shared component. Uses the `--pill-*` tokens. `--fs-xs --fw-semibold`. Pill-radius.

### Empty state (`<EmptyState icon title body cta>`)
- Centered. Icon 48 px (`--text-dim`), title `--fs-xl --fw-bold`, body `--fs-md --text-muted`, optional primary button.
- Default copy is friendly, not technical: "Nothing scheduled today. Tap + to add a visit."

### Loading & error states
- **Skeleton** for any list (3 placeholder rows shimmering) — never spin a global loader.
- **Error** in-line with retry: card with `--status-danger-bg`, title "Something went wrong," body short message, button "Try again".

---

## §1. Crew Home (`/crew`)

### Purpose
The field worker's morning glance: am I clocked in, what's my next stop, what do I owe, anything I need to read.

### Layout (top → bottom)
1. **Greeting + date** — `Good morning, Ronnie` + today's date in business TZ.
2. **Clock In/Out card** — primary surface. Big button. Shows live elapsed time when clocked in.
3. **My next visit card** — *replaces* the current "No visits scheduled today" stub.
4. **Today's jobs** — list of jobs scheduled for today (max 3, "View all" → `/crew/schedule`).
5. **My to-dos** — only items that require *this user* to act:
   - Photos owed on jobs I touched (count)
   - Signatures owed on completed visits (count)
   - Time entries with no associated job (count)
   - Receipts to upload (count)
6. **Recent notifications** — latest 3 (mirrors what the bell would show; tap → `/crew/notifications`).

### What does NOT belong on Crew Home
- Business health KPIs (`Job value`, `Visits scheduled` company-wide, `View all` → reports).
- "X require invoicing" — that's an admin task, not a field task. Move to dashboard.
- Quote / invoice counters belong only if filtered to "owned by me".

### Behaviors
- Clock In tap → calls `clockIn()` server action (Phase 1 PR-E). UI optimistic-updates.
- Clock Out tap → opens a confirmation sheet asking which job to attribute the time to (skip if user only had one job assigned today).
- "My next visit" "Get directions" tap → opens platform maps with the visit address as destination.
- Pulling down to refresh re-fetches all sections.

### Empty states
- Not clocked in + no visits scheduled: friendly "Quiet day so far" message.
- No to-dos: "You're all caught up."

### Acceptance criteria
- All "to do" rows route inside `/crew/*`.
- Clock In/Out persists to `time_entries` (Phase 1).
- "My next visit" only appears when the next visit is within the next 24h; otherwise hidden.
- Page renders in < 1s on mid-tier Android (Pixel 6a) over 4G.

---

## §2. Schedule (`/crew/schedule`)

### Purpose
"What am I doing today, this week, where do I drive next."

### Layout
- **Sub-header** (sticky): Day / List / Map segmented control + month label dropdown.
- **Date strip** (sticky under sub-header): horizontal scroller of dates centered on today, ± infinite scroll. Selected date pill = `--accent-500`.
- **View body**: depends on tab.

### 2a. Day view
- Hour gutter from 6A to 8P (with collapse arrow above 6A and below 8P to expand).
- **Current time indicator** — a 1 px line in `--accent-500` with a 6 px dot on the left edge, animating to the current time once per minute. Was missing in v1; required.
- Each Visit renders as a colored block (job color) spanning its time range. Tap → Job detail.
- Empty hours show a faint "+ Add visit" affordance on tap.
- All-day items pinned to the top (e.g. "Travel day", "Office day").

### 2b. List view
- Section headers per day (today, tomorrow, etc.).
- Each row: time range, job title, client, address, distance from previous stop.
- Empty week → empty state with "Plan a visit" CTA.

### 2c. Map view (replaces tiny static map)
- Full-width, fills remaining viewport (no fixed 440×180 px).
- Visit pins for the *selected date's* visits, color-coded by job. Tap a pin → mini-card sheet with visit details and "Open in Maps" + "Job detail" buttons.
- "Locate me" button bottom-left, "Recenter on day" button bottom-right.
- "View all" link at the top opens a fullscreen mode with the same data; the in-app map is the primary view, not a teaser.
- The button that previously opened google.com/maps is removed.

### Header icons (Phase 1 fix)
- Calendar icon: opens a month picker sheet (replaces the dead "April" dropdown).
- Filter icon: opens a sheet with crew-member, job-type, and status filters (replaces the dead filter button).

### Acceptance criteria
- Day view shows a current-time line that updates every 60 s.
- Tapping any pin on Map view opens a card; tapping "Open in Maps" leaves the app explicitly.
- Date strip swipes to past/future weeks beyond the ±6 days currently rendered.
- All three tabs render the same set of visits (parity check).

---

## §3. Timesheet (`/crew/timesheet`)

### Purpose
Crew-side time records: see what I logged, fix mistakes, clock in if I forgot.

### Layout
- **Sub-header**: week-range label + prev/next chevrons. Week starts Monday (matches Schedule; no more disagreement with Home — Phase 1 already fixed the source disagreement).
- **Weekday rows**: Mon → Sun, each with day total ("4h 12m"), tap-to-expand to show entries.
- **Entry row** (expanded): start–end, duration, attached job (if any), edit/delete affordances (long-press or swipe).
- **Add entry** floating button (in addition to Clock In via FAB) for retroactive logging.
- **Week footer**: weekly total + "Submit week" button (Phase 5+ for approvals; stub for now).

### Behaviors
- The "—" trailing icon on each weekday is replaced with a chevron that toggles expand.
- "Add entry" supports manual time + manual job association.
- Editing an entry: opens a sheet with start/end pickers and job selector.

### Acceptance criteria
- Weekly total = sum of all entry durations within the week, in business TZ.
- Edits write to `time_entries` and revalidate Home + Schedule.
- Crossing midnight is handled — an entry started 11:30 PM Mon and ended 12:30 AM Tue counts as 30 min Mon and 30 min Tue (or stored as one entry shown on Mon — pick a convention and document it).

---

## §4. Search (`/crew/search`)

### Purpose
Universal lookup across Clients, Quotes, Jobs, Requests, Visits, Invoices, Expenses.

### Layout
- **Search input** (sticky top, autofocus on screen entry).
- **Type pills** below input: All · Clients · Requests · Quotes · Jobs · Invoices · Expenses · Visits.
- **Results list**: when query empty → "Recently active" (no demo data — Phase 1 cleanup).

### Behaviors (Phase 1 fix delivered the default)
- All pill + query → fan-out across types, ranked exact-match first, then `ilike`, then recency. Cap 30, "View all in [Type]" footer per type.
- Per-pill + query → filter that type only.
- Empty pill + empty query → recently active.
- Recent searches (last 5) shown when input focused with empty query.

### Acceptance criteria
- Pill includes Invoices, Expenses, and Visits (currently missing per audit).
- Every result row shows a type chip ("Client", "Quote", etc.) — abbreviation labels like "Conv" are renamed.
- No demo-data rows appear in production (Phase 1 PR-F).

---

## §5. Notifications (`/crew/notifications`)

### Purpose
Single home for the bell badge. Already specced in Phase 1 PR-C; this section locks the visual.

### Layout
- **Sub-header**: "Notifications" title, "Mark all read" button (right).
- **List**: rows grouped by day (Today · Yesterday · Earlier).
- **Row**: leading icon (entity type), title, body (truncated to 2 lines), relative time. Unread rows have a 6 px `--accent-500` dot at the start.

### Behaviors
- Tap row → mark read + navigate to entity.
- Long-press → action sheet: Mark read/unread, Delete.
- Pull-to-refresh.

### Acceptance criteria
- Bell badge count = count of `unread = true` rows for current user.
- Empty state: "You're all caught up."

---

## §6. Crew More (`/crew/more`)

### Purpose
Account-level utilities for the field worker. NOT admin settings.

### Final menu (Phase 2 §2)
1. **Notifications**
2. **Support** → `/crew/support` (FAQ + contact form, in-app, not `mailto:`)
3. **Profile** → `/crew/profile` (current user only — name, avatar, phone, password change request)
4. **About** → `/crew/about` (app version, build, terms, privacy)
5. **Sign out** (button — confirmation modal)

### What was removed (and why)
- Apps & integrations, Marketing, Subscription, Manage team, Company details — admin scope; lives at `/dashboard/*`.
- Refer a friend — no real referral system; remove until built.
- Product updates — consolidated into Notifications.

### Acceptance criteria
- All 5 menu items route inside `/crew/*`.
- Sign out clears session and lands on `/crew/login`.

---

## §7. Client detail (`/crew/clients/[id]`)

### Purpose
Look up a client in the field, call/text/navigate, see what's open with them.

### Layout
1. **Header card**: avatar (initials), name, status pill, three icon buttons (Call · Text · Address).
2. **Quick info rows**: phone (formatted `(619) 555-0123`), email (validated), address (taps to map).
3. **Activity sections**:
   - Open quotes (count + list)
   - Active jobs (count + list)
   - Recent invoices (count + list)
   - Notes / activity feed (last 5)
4. **Edit** button (top-right of header card) → opens `/crew/clients/[id]/edit` sheet.
5. **Merge** button (overflow menu) → opens duplicate-merge sheet (Phase 4+).

### Behaviors
- Phone tap fires `tel:` (verified working).
- Text tap fires `sms:`.
- Address tap opens platform maps.
- Email tap fires `mailto:` *only if email is RFC-valid*; otherwise the row is shown muted.
- Edit screen mirrors Create form fields + validation.

### Acceptance criteria
- Phone numbers always render formatted.
- Invalid emails are visibly flagged ("Invalid email — tap Edit to fix").
- "Done" button at the bottom is removed (was misleading — nothing was being edited).

---

## §8. Job detail (`/crew/jobs/[id]`)

### Purpose
This screen is currently nearly empty. Spec'd here to have parity with Jobber's "Job/Project" page.

### Layout
1. **Header**: status pill (Lead / Scheduled / In Progress / Done / On Hold / Invoiced), title, client name (link), property address (link), quick action buttons (Call client · Get directions · Start/Stop visit).
2. **Tabs** (segmented control or tabbed view):
   - **Overview** — scope of work (rich text), instructions, quote linkage (link to source quote), expected duration, materials list, equipment list.
   - **Visits** — list of scheduled and completed visits with start/end times, attendees, notes.
   - **Photos** — grid (Before · During · After tabs), upload button.
   - **Time** — entries logged against this job, by user, totals.
   - **Forms & signatures** — pre-pour checklist, completion form, change orders. Signed/unsigned indicators.
   - **Invoices & payments** — linked invoices, payment status.
3. **Floating "Action" button** (within job context) — most useful action by status:
   - Lead → "Convert to Quote"
   - Scheduled → "Start visit"
   - In Progress → "Stop visit"
   - Done → "Send invoice"

### Behaviors
- Status changes write to `jobs.status`. History tracked in an `audit_log` table (out of scope for this PR but design with it in mind).
- "Start visit" creates a `time_entries` row with `job_id` set.
- Photo upload integrates Phase 4's `<PhotoUpload>` component.

### Acceptance criteria
- All fields from §8 are implemented or scaffolded; no remaining "VISITS (0) — that's it" page.
- URL is `/crew/jobs/[id]` (not `/crew/projects/[id]`) per Phase 2 §3.

---

## §9. Quote detail (`/crew/quotes/[id]`)

### Purpose
View, edit, send, and convert a quote in the field.

### Layout
1. **Header**: quote number (single canonical scheme — Phase 2), status pill, client + property.
2. **Meta row**: Issued date (in business TZ), Valid through date, salesperson.
3. **Line items** — rows with name, qty × unit, line total. Tap a row to edit (mobile builder — Phase 4 if not in Phase 1).
4. **Subtotal / Tax / Total** — clearly stacked at the bottom.
5. **Actions** (sticky footer): Edit · Send to client · Convert to Job · Duplicate · PDF · Delete (overflow).

### Behaviors
- Send → opens email/SMS sheet with prefilled subject/body.
- Convert to Job → creates a Job pre-filled with line items + client + property.
- PDF → server-rendered, opens in a new tab.
- Delete → soft-delete with confirmation sheet.

### Acceptance criteria
- Only ONE quote-numbering scheme remains. The other one's column is dropped (or migrated). Picked: `YYYY-NNN` sequential (e.g. `2026-192`) — adjust if Ronnie prefers the date-based.
- All status pills have an actual lifecycle (Draft → Sent → Accepted/Rejected → Expired).

---

## §10. Request detail (`/crew/requests/[id]`)

### Purpose
Inbound inquiry triage. Currently unreachable inside the crew app.

### Layout
1. Header with status pill (New · In review · Quoted · Won · Lost), title, client + property + lead source.
2. The original message body (from website form, OpenPhone voicemail transcript, email forward).
3. Photos attached (if any).
4. Activity log (calls, texts, emails) — chronological feed.
5. Actions footer: Reply (SMS/email) · Convert to Quote · Mark Won/Lost.

### Acceptance criteria
- A Request can be reached from the Search "Requests" pill, the Home "to do" rows, and notification deep-links.
- The "0 new requests" link from Home routes here when count > 0.

---

## §11. Invoice detail (`/crew/invoices/[id]`)

### Purpose
Field-level visibility into what's been billed and paid.

### Layout
1. Header: invoice number, status pill (Draft · Sent · Partial · Paid · Overdue), client.
2. Meta: issue date, due date, amount due.
3. Line items (read-only on mobile in v1).
4. Payments (list of payments + total).
5. Actions: Send reminder · Record payment · PDF · Edit (deeplink to desktop until mobile builder).

### Acceptance criteria
- Status pills update with payment activity.
- Reminder uses Resend (env var present in production already).

---

## §12. Create forms — universal rules

### Required across every Create flow
1. **Required fields marked** with red asterisks.
2. **Inline validation** — errors render *inside the form* (never in URL query string).
3. **Submit button disabled** until required fields are valid.
4. **Save & New** secondary action where it makes sense (Expense, Visit, Time entry).
5. **Cancel returns the user to where they came from**, not Home.

### `/crew/create/client`
- Required: First name + Last name + (Phone OR Email — at least one).
- Phone formatted on blur. Email validated on blur.
- "Add from Contacts" — replaced with platform-aware text: on iOS Safari, instructs how to copy; on Android Chrome, calls Contact Picker. No more permanently-disabled button.
- Address autocomplete via Google Places (or Mapbox if cheaper). Verified-on-save.
- **Duplicate detection on save**: same phone OR email triggers a "Possible duplicate found" sheet listing matches with "Merge" / "Save as new" options.

### `/crew/create/request`
- Required: Client + Title + Body.
- Photo upload works (Phase 4's `<PhotoUpload>`).
- Schedule sub-section is a real picker, not a "COMING SOON" stub. Even if it's a simple "preferred date + time window" picker.

### `/crew/create/task`
- Required: Title.
- Date defaults to today in business TZ.
- Add: priority, recurring rule, attachments. The audit flagged these as missing.

### `/crew/create/expense`
- Required: Title + Total + Date.
- Date defaults to today in business TZ (Phase 1 PR-A).
- Receipt upload works (Phase 4).
- Reimburse-to dropdown: Company-paid (default) · Reimburse to <user>.
- Add: Category (Materials/Fuel/Equipment/Meals/Other), Vendor, Payment method.

### `/crew/create/quote`
- Templates show a **read-only preview** before any creation (Phase 1 PR-B).
- "Create New Quote" opens the mobile builder (Phase 4) — until then, route to a "Quote builder is coming soon — you can start a draft and finish on desktop" stub that *clearly does not insert a row*.

### `/crew/create/job`
- Required: Client + Job title.
- Add: Service address (separate from client address), date/time pickers, estimated duration, materials, site notes.

### `/crew/create/invoice`
- Required: Client.
- Until mobile builder ships, route to a "Pick a job to invoice" sheet — when crew picks a Done job, the invoice is created server-side from the job's quote and the user sees the result. No more empty payload submission.

### Acceptance criteria (forms)
- No form on the crew app saves an invalid record (e.g. no email + no phone).
- No `?error=...` query strings shown to users.
- Photo / receipt upload works on at least one Create flow (Expense is the highest priority).

---

## §13. Cross-screen polish (apply globally)

### Back navigation
- Every detail screen has a back chevron in the header → goes to the parent list (not blindly to Home).
- Inside a sheet/modal, the dismiss is an "✕" in the top-left.

### Phone & date formatting
- One utility for phones: `formatPhone('5076181846') → '(507) 618-1846'`.
- One utility for business-TZ date display: `formatDateBusinessTZ(d, 'short')`.
- Both live in `lib/format/`.

### Toasts
- `useToast()` hook for transient feedback. Replace every URL-bar error.
- Success = green pill, error = red, info = teal. Auto-dismiss 4s, swipe-up to dismiss.

### Offline
- A persistent banner in the header when `navigator.onLine === false`: "Offline — changes will sync when you reconnect."
- Phase 5+ work to actually queue mutations; for v3, just show the banner.

### "COMING SOON" stubs
- Anywhere this label appears today, it must either (a) work, (b) clearly route the user to a working alternative, or (c) be removed. Don't ship features that look real but aren't.

---

## PR plan for Phase 3

| PR | Subject |
|----|---------|
| PR-M | Shared chrome — `<CrewHeader>`, `<CrewBottomNav>`, `<CrewFab>`, `<ListRow>`, `<StatusPill>`, `<EmptyState>`, `<Skeleton>`, `<Toast>` (consolidate into `app/crew/_components`) |
| PR-N | Crew Home rebuild |
| PR-O | Schedule rebuild — Day current-time line, full-screen Map, working header icons |
| PR-P | Timesheet — expandable rows, manual entry add, week-total math |
| PR-Q | Search — add Invoices/Expenses/Visits pills, ranking, recent searches |
| PR-R | Notifications screen content (Phase 1 PR-C is the bell-routing fix; this PR is the visual + interactions) |
| PR-S | Crew More menu rewrite — finalize per Phase 2 §2 |
| PR-T | Client detail — Edit, Merge, formatted phone, validated email |
| PR-U | Job detail — Overview/Visits/Photos/Time/Forms/Invoices tabs |
| PR-V | Quote detail — actions footer, line item editing (or read-only with builder deeplink) |
| PR-W | Request detail — make reachable + lay out |
| PR-X | Invoice detail |
| PR-Y | Create forms — universal rules + per-form requireds + validation + duplicate detection |
| PR-Z | Cross-screen polish — back nav, phone/date utilities, toasts, offline banner |

PRs M, Y, Z are foundational; the others depend on M. Y and Z can run in parallel with everything from N onward.

---

## Definition of done for Phase 3

1. Every screen in the menu (Home, Schedule, Timesheet, Search, More) and every detail screen reachable from them matches its spec above.
2. No screen contains a "COMING SOON" stub that creates phantom data on tap.
3. The 14 cross-cutting issues from `crew-app-audit.md` §"CROSS-CUTTING ISSUES" are closed.
4. Mobile-device walkthrough on iPhone Safari and Android Chrome passes the §0 chrome behaviors and §1–§12 acceptance criteria.

When all four hold, the app is functionally at parity with Jobber's mobile patterns. Phase 4 fills the remaining "COMING SOON" features (photo upload, mobile quote/invoice builders, reimbursable expenses). Phase 5 is offline mode, push notifications, and polish.

---

## Out of scope for Phase 3 (explicitly)

- Push notifications (web push or native).
- Offline write queue (we just show the banner in Phase 3).
- Per-job clock-in (user-level only in Phase 1; per-job comes with Phase 3 PR-U if simple, otherwise Phase 4).
- Two-way SMS conversation thread inside the app.
- Receptionist / AI features.
- Marketing / Reviews / Pipeline / Insights — admin tools, not crew-app concerns.
