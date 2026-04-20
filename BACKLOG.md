# Build Queue

---

## ☕ WAKE-UP NOTE — overnight round 15 (2026-04-19, overnight)

`npx tsc --noEmit` passes. **One new migration (041)** plus the
unapplied ones from prior rounds. Run in Supabase in this order
if any are outstanding:

1-5. 034 → 038 (prior rounds, see earlier wake-up notes).
6. **`migrations/039_cash_journal.sql`** (round 12).
7. **`migrations/040_multi_tenant.sql`** (round 14, rewritten in
   round 14.5 to be fully idempotent — safe to re-run).
8. **`migrations/041_job_estimation.sql`** — new this round. Adds
   `actual_hours_worked` to `project_phases`, creates
   `job_phase_durations` + `job_total_estimates` views, adds
   `compute_phase_durations(project_id)` helper and a
   BEFORE-UPDATE trigger on `visit_time_entries` that refreshes
   phase hours every time a crew member clocks out. Safe to
   re-run.

**Ronnie — things I need from you:**

- Once you create the prod Vercel domain and point DNS, set
  `NEXT_PUBLIC_APP_URL` in Vercel env to the real URL. Until
  then the hardcoded fallback (`rose-concrete-app-v2.vercel.app`)
  keeps magic links landing on the right host.
- Supabase → Auth → URL Configuration → Site URL must match the
  app URL (see DEPLOY.md §5). Redirect allowlist must include
  `/auth/callback` on every host you use.

### What shipped this round

- **Vercel magic-link fix (hardcoded fallback).** `resolveAppUrl()`
  now includes a fourth fallback step — if we're running on
  Vercel (`VERCEL=1`) but `NEXT_PUBLIC_APP_URL`, request host,
  and `VERCEL_URL` all fail to produce a usable origin, we use
  the hardcoded preview URL so magic links don't silently land
  on localhost.
- **Job estimation intelligence.** Migration 041 + `lib/job-estimation.ts`
  + `/dashboard/reports/job-estimation`. Rolls up completed jobs
  by (service_type × sqft bucket) to answer "what should a 500sqft
  stamped driveway cost / take?" Phase hours come from
  `visit_time_entries` via a BEFORE-UPDATE trigger that re-sums
  when a clock-out lands. Confidence scores (0-100%) shown next
  to every row so Ronnie knows whether the average is backed by
  enough jobs.
- **Smart estimating on quote editor.** New
  `<SmartEstimateChip>` component rendered on the quote detail
  page. Pulls the matching historical bucket, compares to the
  quote's grand total, and surfaces tone-coded chips:
    - **green** = "In line with similar jobs"
    - **amber** = "~25% above average"
    - **red** = "~40% below average — check the scope"
  Includes suggested price range (low / median / high), $/sqft,
  estimated days, and a rationale line. Renders nothing when
  there's no matching history yet.
- **Crew home rewrite.** The Today screen is now thumb-first:
    - Full-width cards with colored header strip (brand navy →
      amber while clocked in → emerald when complete).
    - Primary row = Google Maps navigation + "Call {first name}"
      (two 56px-tall buttons side-by-side).
    - Secondary row = Clock in/out + "On my way" with 3 preset
      ETA buttons (15/30/45 min).
    - Photo upload CTA is now the most prominent action on every
      visit — 64px-tall, brand-blue, shows live "2/3" count and
      flips emerald once the gate is satisfied.
    - Mark complete button grows to min-h-12 with icon + label.
  Every tap target is ≥44pt (iOS guideline); no more tiny chips.
- **`On my way` auto-SMS with preset ETAs.** Open → pick 15/30/45
  → sends via existing `sendOnMyWayAction`. Chip stays expanded
  to show the confirmation (no reload needed).
- **Photo reminder — second fire at 6pm PT.** The existing 4pm
  cron now self-gates for TWO PT hours (16 + 18). The 6pm run
  only nags crew who still have zero uploads — anyone actively
  uploading gets skipped. Second reminder's body is firmer and
  includes the job address so crew can't dismiss it. `vercel.json`
  runs the cron at both 23:00 UTC (4pm PDT) and 01:00 UTC
  (6pm PDT).
- **In-app notifications** on quote approved, form signed, and
  payment received (on top of job-completed which already fired
  from round 12's completion flow). All route through the
  existing `notifyUsers` helper so they also fire web pushes
  when VAPID keys are configured.
- **Daily morning summary.** New cron at
  `/api/cron/morning-summary` fires 7am PT each day. Per-tenant:
  counts today's visits + overdue invoices + unsigned customer
  forms + cold leads (new status >24h) and sends one
  notification to each office/admin user with the rollup as the
  body. Skips tenants with zero items.
- **Crew PWA offline mode.** `public/sw.js` rewritten:
    - Precaches `/crew` + `/crew/schedule` + `/crew/upload` +
      `/crew/form` on install.
    - Stale-while-revalidate on `/crew/*` navigations — crew
      opens the app without signal and sees yesterday's Today
      screen; when signal comes back it refreshes in the
      background.
    - Cache-first for images and Next.js static chunks so
      repeat visits are instant.
    - Only intercepts GETs — POSTs / server actions always hit
      the network so writes don't go stale.
  Registered from `app/crew/sw-register.tsx` (mounted in the
  crew layout) via `requestIdleCallback` so it doesn't fight the
  initial render.
- **Loading skeletons.** New `components/skeletons.tsx` with
  `<SkeletonLine>` / `<SkeletonBlock>` / `<SkeletonCard>` /
  `<SkeletonList>` / `<SkeletonTable>` / `<SkeletonPageHeader>`.
  Applied to `app/dashboard/{projects,clients,quotes,schedule}/loading.tsx`
  + `app/dashboard/reports/job-estimation/loading.tsx` +
  `app/crew/loading.tsx`. First paint now shows the right shape
  instead of a blank page during SSR.
- **Job estimation link on Reports index** — primary action
  button at the top of `/dashboard/reports`.

### Deferred / not started

- **Virtualized lists.** Current lists (clients, projects,
  quotes) load 200 rows max via `.limit(200)`. Virtualization
  (react-virtuoso / react-window) is a separate round once row
  counts cross 500.
- **Prefetch common navigation paths.** Next.js prefetches
  `<Link>` hrefs by default on idle — the crew app already
  benefits. Explicit `prefetch=true` hints for the dashboard
  primary-nav links is a small follow-up.
- **Swipe gestures on mobile.** The crew app is tap-only today.
  Adding `react-use-gesture` for "swipe to mark done" is a
  separate round.
- **Offline write queue for crew app.** Today the service worker
  serves stale reads offline but writes (clock in, photo
  upload) still require signal. A background-sync queue that
  replays pending uploads when the connection returns is a
  separate round.
- **Tenant-aware morning summary** — today counts overdue invoices
  globally (no `tenant_id` on payment_milestones yet). If Rose
  is the only paid tenant, this is cosmetic; add tenant scope
  before the second tenant goes live.

### Earlier wake-up notes kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 14 (2026-04-19, overnight)

`npx tsc --noEmit` passes. **One big new migration: 040** —
multi-tenant foundation. Plus the unsent ones from earlier rounds:

1. `migrations/034_automation_rules.sql` (round 9)
2. `migrations/035_push_subscriptions.sql` (round 9)
3. `migrations/036_invoice_display_archive_signatures.sql` (round 10)
4. `migrations/037_archive_cascade.sql` (round 11)
5. `migrations/038_phases_forms_reminders.sql` (round 12)
6. `migrations/039_cash_journal.sql` (round 12)
7. **`migrations/040_multi_tenant.sql`** — new this round.

Migration 040 is additive + idempotent but heavy: creates `tenants`
+ `pending_tenant_signups` tables, adds `tenant_id` + indexes to
~24 data tables, replaces per-table admin-role RLS policies with
tenant-scoped policies, adds a BEFORE INSERT trigger on each data
table that auto-stamps `tenant_id` from `current_tenant_id()` so
existing app code Just Works. Also revises the `handle_new_user()`
trigger to read from `pending_tenant_signups` and create fresh
tenants for new signups. Backfills the existing Rose data to a
hardcoded tenant uuid (`11111111-…`) so nothing disappears.

### What shipped this round

- **Multi-tenant foundation.** `tenants` table with plan / status /
  trial_ends_at. `profiles.tenant_id` non-null, indexed. Tenant
  isolation enforced at the DB layer via RLS policies on every
  user-facing table that join back to `current_tenant_id()`. A
  BEFORE INSERT trigger (`auto_stamp_tenant_id`) auto-fills
  `tenant_id` on all inserts so the ~50 existing create actions
  don't need to be touched.
- **Signup flow** at `/signup`. Public page (not behind auth).
  Collects company name + email, writes a `pending_tenant_signups`
  row via the service-role client, fires a Supabase magic link.
  When the user clicks the link, `handle_new_user()` reads the
  pending row, creates a fresh `tenants` row with 14-day trial,
  seeds business_profile + invoice_settings + feature_flags for
  the new tenant, and promotes the user to admin of it. Linked
  from the login page.
- **lib/tenant.ts** — `getCurrentTenantId()`, `requireTenantId()`,
  `getTenantInfo()` helpers with React-cache wrappers so repeat
  calls within a single SSR render are free.
- **Workspace settings page** at
  `/dashboard/settings/workspace`. Admin-only. Shows tenant name +
  slug + plan + trial status + teammate list. Rename / reslug via
  `updateWorkspaceAction`.
- **Dashboard shell renders tenant name** — pulled via
  `getTenantInfo()` in the layout, passed to `<DashboardShell>`,
  replaces the hardcoded "Rose Concrete" in the sidebar brand. So
  "Bay Area Concrete" users see their company name on every page.
- **Integrations status page** now includes every env-var check
  so new tenants can see at a glance which integrations still need
  configuration.
- **`DEPLOY.md`** — 14-section Vercel deployment guide with every
  env var documented, Supabase auth configuration steps, cron job
  verification, per-tenant upgrade instructions, rollback
  procedure, and a checklist for the first production tenant.
  README.md now links to it.
- **`/api/health`** endpoint for uptime monitors. Returns
  `{ok:true, commit, env}` — no auth required, no PII.
- **Middleware public-path updates** — `/forms/`, `/api/health`
  added so they work on the marketing host. `/signup` + `/login`
  intentionally kept app-subdomain-only to avoid cookie scope
  cross-domain confusion.

### How new tenants work

1. User hits `app.yourdomain.com/signup`.
2. Enters company name + email → backend writes
   `pending_tenant_signups` + sends magic link.
3. User clicks magic link. Supabase creates `auth.users` row →
   fires `on_auth_user_created` trigger → runs `handle_new_user()`.
4. Trigger creates tenant (status=trial, 14-day expiry), creates
   profile pinned to that tenant with role=admin, seeds
   business_profile + invoice_settings + feature_flags.
5. User lands on `/dashboard` — fresh isolated workspace.

### Deferred / not started

- **Per-tenant subdomains** (`bayarea.app.yourdomain.com`). Today
  every tenant lives under the same app.* host. Wildcard DNS +
  middleware host → tenant lookup is a separate round.
- **Stripe billing** — `tenants.plan` is display-only. Payment
  flow + trial-end enforcement is a separate round.
- **Team invite link** — admin can see teammates on the Workspace
  page but inviting still routes through
  `/dashboard/settings/team` (existing flow, pre-tenant). Next
  round: stamp invites with the admin's tenant_id so invitees
  auto-join.
- **Cross-tenant operations for platform support** — no way to
  browse all tenants as a super-admin yet. If this app ever needs
  to troubleshoot a customer's data, super-admin tooling is a
  separate round.
- **Tenant isolation on storage** — Supabase Storage keys are
  polymorphic today (`attachments/<entity>/<id>/<filename>`).
  Storage RLS not enforced by tenant yet; `storage.foldername()`
  + a tenant-prefix migration is a follow-up. Today: tenant
  isolation is enforced at the row level (only your tenant's
  attachment rows are queryable), but a service-role signed-URL
  generator could theoretically cross tenants.

### Earlier wake-up notes kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 13 (2026-04-19, overnight)

`npx tsc --noEmit` passes. **No new migrations this round** — every
change is env-var / adapter / UI polish on top of the schema already
defined in migrations 034-039.

**Env vars to set for the new integrations:**

- Gmail auto-attach (three vars; bootstrap with
  `node scripts/gmail-oauth-bootstrap.js`):
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
  - `GMAIL_REFRESH_TOKEN`
- OpenPhone was already there — `OPENPHONE_API_KEY` (no change; this
  round just extended message mapping to pull MMS `media_urls` so
  the auto-attach cron has something to download).

### What shipped this round

- **Real Gmail OAuth adapter** in `lib/gmail.ts`. Swapped the stub
  for a REST client that refreshes access tokens on demand (cached
  for ~55 min), lists messages with `q=after:<unix> in:inbox`,
  fetches full message payloads + recursively walks parts to
  extract attachments, and base64url-decodes attachment bytes. The
  `email-auto-attach` + `gmail-permit-scan` crons now deliver real
  work once `GMAIL_*` env vars land. When env is unset, falls back
  to the stub so the app still boots.
- **Gmail OAuth bootstrap script** at
  `scripts/gmail-oauth-bootstrap.js`. One-off helper Ronnie runs
  locally: starts a localhost:4873 callback server, prints the
  Google consent URL, captures the `code`, swaps for a refresh
  token, and prints the `GMAIL_REFRESH_TOKEN=...` line ready to
  paste into `.env.local`. No backend credential table needed —
  Rose is single-tenant.
- **Gmail Watch settings page** gets a green-check / amber-warning
  banner based on `getGmailAdapter().isConfigured()`. The amber
  path walks Ronnie through the 4-step setup (Cloud Console →
  env vars → bootstrap script → restart).
- **OpenPhone MMS — `media_urls` fully wired.** The real REST
  adapter's message mapper now pulls media from both `media: [{url}]`
  (new OpenPhone shape) and `mediaUrls: string[]` (legacy). The
  `/api/cron/openphone-media-attach` cron that saves inbound MMS
  to the matching client is now fully functional.
- **Integrations status page** at
  `/dashboard/settings/integrations` — single-glance view of all
  six integrations (Gmail, OpenPhone, Resend, Web Push, QBO,
  Anthropic) with green/amber dots + per-row "Configure →"
  links to the detail pages. Linked from Settings index.
- **Customer forms (`/forms/[token]`) polish pass.**
  - Dedicated viewport with `maximumScale=1` so iOS pinch-zoom
    doesn't steal focus from the signature pad.
  - Full-bleed brand-navy header, progress pill ("2 of 5
    required"), large checkbox rows (6px/6px, ~48px tall) that
    turn emerald when checked, and a sticky mobile Submit button
    pinned to the bottom with iOS safe-area padding.
  - Auto-scroll to the signature pad if the customer tries to
    submit without drawing.
  - Vimeo support in the video player alongside YouTube + MP4.
  - Branded completion page pulls business_profile phone/email
    for the "reply back" contact info.
- **Phase timeline always shows 5 phases.** Previously a project
  without seeded phases showed a single "No phases yet" card.
  Now it renders all 5 default phases as grey placeholder pills
  (Demo / Prep / Pour day / Cleanup / Completion inspection)
  with a "Create phases to edit" button — so Ronnie always sees
  the full visual timeline and can click into any phase to start
  the SMS draft flow.
- **Cash-journal PDF export polish.** The "Print / Export PDF"
  button on the main page now forwards filter query-string to the
  print view (so the export matches what's on screen) and opens
  in a new tab. The print page auto-triggers `window.print()`
  400ms after mount for a one-click export (skip with
  `?noautoprint=1`).
- **Dashboard-shell print CSS.** Added `@media print` rules that
  hide the sidebar + top bar + sidebar offset so cash-journal /
  statement / invoice PDFs print clean without the app chrome.
  Dark-mode surfaces force back to white under print so the
  exported file doesn't come out near-black.
- **Web Push confirmed installed** — `web-push` + `@types/web-push`
  are in `package.json` (landed round 11), node_modules on disk,
  typecheck clean. Delivery flips on the moment VAPID env vars
  are set; test via Settings → Notifications → Send test push.

### Deferred / not started

- Multi-tenant Gmail OAuth (one mailbox per user) — today's env-var
  approach is fine for Rose's single mailbox; needs a
  `gmail_credentials` table + OAuth callback route when a second
  account is ever watched.
- OpenPhone MMS thumbnail pre-generation — today we save the raw
  image to storage; generating signed thumbnails for the client
  feed UI is a follow-up.
- Gmail webhook (push notifications) — today we poll every 15 min
  via cron. Gmail supports Pub/Sub webhooks that would deliver
  messages in near-real-time, but requires GCP Pub/Sub setup +
  domain verification; not worth it at Rose's volume yet.

### Earlier wake-up notes kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 12 (2026-04-19, overnight)

`npx tsc --noEmit` passes. **Two new migrations (038, 039)** plus the
four unsent ones from earlier rounds — run in Supabase in this order:

1. **`migrations/034_automation_rules.sql`** (round 9).
2. **`migrations/035_push_subscriptions.sql`** (round 9).
3. **`migrations/036_invoice_display_archive_signatures.sql`** (round 10).
4. **`migrations/037_archive_cascade.sql`** (round 11).
5. **`migrations/038_phases_forms_reminders.sql`** — new this round.
   Adds `project_phases`, `project_crew_members`, `customer_forms`,
   `customer_form_responses`, `crew_photo_reminders`; adds
   `demo_ack_required` / `demo_ack_at` to `projects`; adds
   `email` value to the `comm_channel` enum; adds welcome-video +
   phase-SMS template columns to `business_profile`.
6. **`migrations/039_cash_journal.sql`** — new this round. Adds
   `cash_journal_entries` (with `cash_journal_kind` enum) + RLS so
   crew write their own, office signs off.

### What shipped this round (job lifecycle batch)

- **Pre-demo welcome video + acknowledgment form.** New `/forms/<token>`
  public page renders a configurable video (Settings → Business
  profile → Welcome video URL) + four acknowledgment checkboxes
  (irrigation, gas, tree roots, cracks) + signature. When signed,
  `projects.demo_ack_at` is stamped. **Gate:** updateProjectAction
  now blocks a status change into `active` until the ack is on file
  (unless `demo_ack_required` is explicitly false).
- **Pre-pour inspection form.** Same `/forms/<token>` engine, five
  confirm-with-initials items (mix / pattern / finish / color /
  special requests) + signature. When signed, auto-creates a
  high-priority "Order concrete for &lt;project&gt;" task for Ronnie.
- **Job completion form.** Customer signs off on work complete +
  satisfactory. Triggers the full completion flow via
  `lib/completion-flow.triggerProjectCompletionFlow`.
- **Completion flow end-to-end.** When either the last phase is
  marked done OR the customer signs the completion form, the flow
  flips the project to `done`, ensures the completion form row
  exists, calls `generateInvoiceForProjectAction` (QBO invoice is
  idempotent), creates a "Collect final payment" task, and fires
  an in-app + web-push notification to office. All idempotent —
  safe to invoke from both paths.
- **Multi-phase job scheduling + timeline.** `project_phases` table
  with five defaults (demo / prep / pour / cleanup / inspection).
  `<PhaseTimeline>` renders horizontal status pills; clicking one
  expands an editor for start/end dates, notes, status, and an
  OpenPhone SMS draft. Draft bodies are rendered from
  business_profile templates (merge tokens:
  `{client_name} / {address} / {dates} / {service_type} / {notes}`)
  with hardcoded fallbacks when Ronnie hasn't edited them yet.
- **Auto-text drafting per phase.** When a phase is scheduled the
  UI rebuilds the text + recipients from business_profile
  templates. Ronnie reviews and taps **Review + send** — never
  auto-sends. Demo text defaults to Willy; pour text to Willy +
  Roger + Michael (configured via `phase_to_demo` / `phase_to_pour`).
  Delivery via OpenPhone adapter; results logged to activity_log.
- **Photo-upload gate.** Crew cannot tap Mark complete until 3
  photos exist on the project. The button shows live count
  ("Need 2 more photos (1/3)") with an Upload link right next to
  it, in English + Spanish.
- **Daily 4pm crew photo reminder cron.**
  `/api/cron/crew-photo-reminders` runs hourly; guards on PT hour
  so it fires once a day at 4pm. SMS each assigned crew member
  via OpenPhone, writes `crew_photo_reminders` audit rows with
  denormalized `uploads_at_send` count. Project page shows a
  **Today's photo compliance** strip: green pill "Alex · ✓ 4
  photos" / amber pill "Willy · 0 photos — follow up".
- **Cash journal for day laborers.** `/dashboard/cash-journal`
  admin page with entry form, date/worker/kind/amount/project/
  description/notes, foreman sign-off toggle, weekly totals per
  worker, + a print-to-PDF view at `/dashboard/cash-journal/print`.
  Linked from the sidebar; RLS lets crew see their own + admin/
  office see all.
- **Email auto-attach cron** at `/api/cron/email-auto-attach`.
  Matches sender email to `clients.email`; writes a
  `communications` row (new `email` enum value lets the client
  feed surface it), auto-attaches PDFs to the client's most
  recent active project, everything else to the client record.
  Unmatched emails counted + sampled in the JSON response for
  manual review. Runs every 15 min alongside the existing
  permit-scan cron.
- **OpenPhone MMS auto-attach cron** at
  `/api/cron/openphone-media-attach`. Adds `media_urls?` to the
  `OpenPhoneMessage` type so the real adapter can populate
  attachments; cron downloads + saves each media item as an
  attachment on the matching client. No-op when `media_urls` is
  empty (stub / adapter doesn't support MMS yet).
- **Settings: welcome video URL + phase-SMS templates + recipient
  phones** — added to `/dashboard/settings/business-profile` under
  Welcome video and Phase SMS templates sections.
- **Sidebar nav** — Cash journal now appears in the left nav
  between Expenses and Reports.

### Deferred / not started

- **Active-project list Archived tab** — round 11 filters archived
  rows out but there's no explicit "view archived projects" tab
  yet.
- **Email adapter media support** — `email-auto-attach` cron works
  today for text + the existing Gmail attachment interface, but
  inbound-email-with-PDF requires the real Gmail MCP bridge to be
  wired (current adapter is a stub).
- **OpenPhone adapter MMS support** — `media_urls` field is on the
  `OpenPhoneMessage` type but the real adapter doesn't populate
  it yet. Hook up when the real REST client lands.
- **Full phase-level RLS for crew reads** — crew can read phases
  they're assigned to, but `project_crew_members.user_id` still
  has to be manually populated. A future round auto-links crew to
  projects via scheduled visits.

### Earlier wake-up notes kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 11 (2026-04-19, very late)

`npx tsc --noEmit` passes. **One new migration (037)** plus the
unsent ones from earlier rounds — run in order:

1. **`migrations/034_automation_rules.sql`** (round 9).
2. **`migrations/035_push_subscriptions.sql`** (round 9).
3. **`migrations/036_invoice_display_archive_signatures.sql`** (round 10).
4. **`migrations/037_archive_cascade.sql`** — new this round. Adds
   `archived_at` to `projects`, `quotes`, and `leads` so archiving
   a client can cascade. Additive only.

**`npm i` must be run** — `web-push` + `@types/web-push` are new
dependencies this round (see package.json). `npm i` already ran
locally but the lockfile + node_modules need to land in the repo /
deploy target.

**Env vars to add** (already documented in `.env.local.example`):
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT=mailto:ronnie@sandiegoconcrete.ai`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same as `VAPID_PUBLIC_KEY`, exposed
    to the browser)

Generate with `npx web-push generate-vapid-keys`.

### What shipped this round

- **Per-milestone signature capture.** `submitPaymentSignatureAction`
  now takes a `scope` param (`"milestone"` default, `"schedule"`
  fallback) and stores a signature row tied to the specific milestone
  the customer paid. The SignaturesPanel on the project page shows a
  scope badge — "Invoice" for schedule-level, "#N · <label>" for
  per-milestone — so Ronnie always knows which payment was authorized.
- **Signed-invoice PDF** at `/dashboard/projects/[id]/invoice-pdf`.
  Same browser-print-to-PDF pattern as statements/change-orders;
  embeds every captured signature inline with signer name + date +
  scope. Respects the schedule's client-view toggles (`show_late_stamp`,
  `show_line_totals`, `show_account_balance`). "📄 Invoice PDF" link
  added to the project page action bar.
- **Archive cascade.** Archiving a client now also stamps
  `archived_at` on every project, quote, and lead that belongs to it
  (migration 037 adds the column to all three). Unarchive reverses.
  Projects / quotes / requests default lists filter archived rows
  out (`.is("archived_at", null)`) so the everyday views stay clean.
- **Dark mode sweep** across the app. Rather than edit every detail
  page individually (100+ files), I added:
    - `dark:` variants on every primitive in `components/ui.tsx`
      (PageHeader, Card, JobCard, EmptyState, StatusPill, StatusPillLink,
      PrimaryButton, SecondaryButton) — so anything built on those
      gets dark mode for free.
    - CSS shims in `app/globals.css` that override the common
      Tailwind surface classes (`.bg-white`, `.bg-neutral-50`,
      `.border-neutral-200`, `.text-neutral-*`, `.divide-*`) under
      `html.dark`. That catches raw Tailwind on detail pages that
      don't use the primitives.
    - Print-to-PDF pages (`.statement` / `.invoice`) opt out of the
      shims so Save-As-PDF always produces a white-paper output.
    - Explicit `dark:` classes on the SignaturesPanel since it
      renders inline PNG signatures.
- **Spanish translations for `/crew/schedule` + `/crew/upload`.**
  Schedule page localizes the weekday + time formatter via
  `es-US` locale when `lang=es`, and the "This week" title + Call
  badge. Upload page has a full per-lang copy map for project /
  tag / caption / tap / uploading / recent + Spanish tag labels
  (antes / durante / después / entrada / patio / estampado).
- **VAPID push notifications — end to end.** `web-push` + typings
  now in `package.json`. `lib/push.ts` rewritten to use the static
  import and initialize VAPID once per process. New `lib/notify.ts`
  helper (`notifyUsers`) consolidates the "insert notifications row
  + fire push" pattern — wired into `lib/leads.ts` (new-lead
  notifications) and the automations `notify_office` action. A
  "Send test push" button on `/dashboard/settings/notifications`
  lets Ronnie verify delivery; the page swaps between a "scaffold
  only" amber explainer and the test-send UI based on whether
  VAPID env vars are set.

### Deferred / not started

- Mass-migrating every detail page to explicit `dark:` Tailwind
  classes. The CSS shims cover the common case, but individual
  pages that use brand color gradients or one-off accent colors
  will still need per-page touch-ups.
- Full archived-record browser — Clients has Active/Archived tabs,
  but projects / quotes / requests just hide archived rows. An
  "Archived" tab on each with counts is the follow-up.
- Quiet hours / per-event opt-ins for push notifications — today
  it's all-or-nothing per user; granular control (e.g. "new_lead
  yes, job_completed no") is a separate round.

### Earlier wake-up notes kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 10 (2026-04-19, late)

`npx tsc --noEmit` passes. **One new migration** (036) plus the two
unsent from round 9 — so Ronnie should run, in order:

1. **`migrations/034_automation_rules.sql`** (from round 9 — run
   this first if it wasn't already applied).
2. **`migrations/035_push_subscriptions.sql`** (from round 9).
3. **`migrations/036_invoice_display_archive_signatures.sql`** —
   new this round. Additive only:
   - `payment_schedules`: adds `allow_card` / `allow_ach` /
     `allow_partial`, `show_quantities` / `show_unit_price` /
     `show_line_totals` / `show_account_balance` / `show_late_stamp`,
     `sent_at` / `sent_by` / `sent_channel`, `require_signature`.
   - `clients`: adds `archived_at`, `archived_reason` + partial
     index for the Archived tab.
   - `line_item_templates`: adds `is_bookable_online` (default true)
     and `booking_display_name` for the public booking form.
   - Creates `signatures` table (polymorphic entity_type/entity_id
     + signer_name + png_data_url + captured_at/ip/ua) with RLS.

### What shipped this round (Jobber parity batch)

- **Invoice sidebar** on the project page's Billing tab. Three
  grouped sections of Jobber's "Invoice settings":
  *Online payment* (Card / ACH / Partial) · *Client view* (Show
  quantities / unit prices / line totals / account balance / late
  stamp — lets Ronnie hide markups from clients) · *Signature*
  (Collect at payment) · *Delivery* (Mark as sent / Undo). All
  toggles optimistic, all write to activity_log.
- **Job Profitability donut** widget on every project detail page
  — pure-SVG four-slice donut (Line items / Labour / Expenses /
  Profit) with center "profit + margin %" text. Cost is bucketed
  from `job_costs.category`/`memo` keywords (labor/material/etc.)
  so the split works even without explicit cost sources. Sits above
  the existing QBO margin table.
- **Job Billing tabs** — wraps the milestones list + reminders
  into an "Invoicing" / "Reminders" tabbed pane next to the new
  InvoiceSidebar. Reminders tab groups scheduled `payment_reminders`
  under each milestone with status pills + sent timestamps.
- **Mark as Sent** — manual override in the sidebar for when
  Ronnie sent the invoice out-of-band (printed, PDF forwarded).
  Stamps `sent_at` / `sent_by` / `sent_channel`; Undo clears them.
- **Log in as Client** + **Send login email** — two buttons on
  every client detail page. "Log in as client" opens the client's
  `/hub/<token>` URL in a new tab (same credential the client
  would use — no session shenanigans). "Send login email"
  transactionally emails the hub link via Resend. Both log to
  activity_log.
- **Archive client** — soft-delete with `archived_at` +
  optional reason. Clients list now has **Active / Archived
  tabs** with counts; the detail page shows an amber banner when
  archived plus a Restore button.
- **One-click create-anything bar** on the client page — primary
  buttons for Request / Quote / Job / Visit, plus a **+ More ▾**
  popover for Invoice / Payment / Task / Property / Contact.
  Everything deep-links to the right form with `client_id`
  prefilled. "Property" + "Contact" jump to the inline panels
  already on the client page. "Invoice" + "Payment" route to the
  client's primary project's `#billing` anchor.
- **Online booking visibility per product** — products catalog
  editor now has a **Show on booking form** checkbox + optional
  **Booking display name** override per product. Public `/book`
  page fetches `is_bookable_online=true` + `is_active=true`
  templates and renders them as a grouped "Specific service
  (optional)" `<select>` with `<optgroup>` by category. Selection
  gets prepended to the lead message so Ronnie sees it in the lead
  card.
- **Invoice signature collection** — pure-canvas SignaturePad
  component (no deps, works on mouse + touch, ~110 LoC). When
  `require_signature` is on, the /pay/<token> page gates method
  selection until the customer types their name + draws their
  signature; the PNG data URL + name + IP + UA get saved to the
  `signatures` table. A **Captured signatures** panel on the
  project detail renders the drawings inline for Ronnie's audit
  trail.

### Deferred / not started

- Per-milestone signature capture (currently per-schedule only)
  — migration 036 supports it polymorphically, PayForm already
  knows the milestone id, just not wired UI-side yet.
- PDF export of a fully-signed invoice — today the captured PNGs
  render in-app; embedding into a printable invoice PDF is
  follow-up work.
- Archive cascade on quotes / projects — archiving a client today
  just hides the client; a full "cascade archive" like Jobber
  (hides orphaned quotes/jobs too) is a separate round.

### Original round-9 wake-up note kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 9 (2026-04-19, overnight)

`npx tsc --noEmit` passes. **Two new migrations** to run in Supabase,
in order:

1. **`migrations/034_automation_rules.sql`** — creates the
   `automation_trigger` + `automation_action_kind` enums, the
   `automation_rules` + `automation_rule_runs` tables, and seeds 3
   default rules (quote_approved SMS thank-you, lead_captured
   office notify, job_completed create-review-request task).
2. **`migrations/035_push_subscriptions.sql`** — creates
   `push_subscriptions` (user_id, endpoint, p256dh, auth,
   user_agent). RLS restricts each user to their own rows; office
   + admin can read all for debugging.

### What shipped this round

- **Automations engine** at `/dashboard/settings/automations`. Real
  rules table (migration 034) with trigger / conditions / actions
  modeled as JSON. UI: enable/disable toggles, create/edit form
  with quick-insert action buttons, per-rule recent-runs table,
  token reference. Dispatcher wired into the quote-approved path
  (`app/q/[token]/actions.ts`) and the project-status-change path
  (`app/dashboard/projects/actions.ts` — fires `job_completed`).
  Actions: `send_sms` (OpenPhone), `send_email` (Resend),
  `create_task`, `move_status`, `notify_office` (now pushes too,
  see below). Best-effort — never blocks the caller.
- **Custom-field rendering** on client / project / quote detail
  pages. `lib/custom-fields.ts` + `<CustomFieldsPanel>` with inline
  auto-save on blur. Stores into the typed column matching the
  field_type (`value_text` / `value_number` / `value_date` /
  `value_bool`). Schema already existed from migration 021 + the
  round-8 admin editor — this is the missing read/write surface.
- **Route optimization** on the schedule day view. Nearest-neighbor
  (haversine) when stops have lat/lng; falls back to city clustering
  with time-order preserved per cluster. Numbered badges on each
  stop; the "🗺 Route (optimized) in Google Maps" button hands
  Google the re-ordered multi-stop URL. No API key needed.
- **Monthly PDF statements** at
  `/dashboard/clients/[id]/statement`. Date-range pickers default
  to current month; browser print-to-PDF (`window.print()`) with
  `@page letter` + print CSS. Includes business header, bill-to
  block, invoiced/paid/outstanding summary, and per-milestone
  activity table. Linked from the client detail quick-action bar.
- **Dark mode** toggle — cookie-based (`theme=light|dark`), read in
  root layout so first paint is correct, toggle button in the
  dashboard header flips optimistically. Tailwind's `darkMode:
  "class"` with `dark:` variants on the shell (sidebar, header,
  nav, card bg). Individual pages can opt in gradually.
- **Spanish language support** for the crew PWA. `lib/i18n.ts` with
  a tiny `t(lang, key)` helper, EN/ES pill toggle in the crew
  header, ~30 translated strings covering the Today screen,
  bottom-nav labels, Clock in/out, On my way, Mark complete, photo
  prompts. English falls through untranslated keys so partial
  translations never crash.
- **Push notifications — scaffolded**. Migration 035 for
  subscriptions, `public/sw.js` service worker (push +
  notificationclick → focus/open), `components/push-enroll.tsx`
  widget at `/dashboard/settings/notifications`, `lib/push.ts`
  with `sendPushToUser()` wired into the `notify_office`
  automation action. **Delivery is dormant** until Ronnie sets:
    - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
      (mailto:ronnie@sandiegoconcrete.ai)
    - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same public key, exposed to
      the browser)
    - `npm i web-push` in the app
  Generate keys with `npx web-push generate-vapid-keys`. Until
  then, `sendPushToUser` logs and no-ops; subscriptions are still
  collected so existing enrollees get pushes the moment it flips
  on.

### Deferred / not started

- Full dashboard dark-mode sweep (cards, tables, form inputs on
  every page). Shell + header done; individual detail pages still
  use light-only Tailwind classes in most places. Safe to land
  page-by-page in future rounds.
- Spanish strings for `/crew/schedule`, `/crew/upload`,
  `/crew/form` — only the Today screen is fully translated this
  round. Pattern is established; straightforward follow-up.
- Push opt-in UX for crew PWA — enrollment widget is admin/office
  only right now. Crew push (e.g. schedule-change alerts) is
  another round once VAPID keys land.

### Original round-8 wake-up note kept below for history.

---

## ☕ WAKE-UP NOTE — overnight round 8 (2026-04-19, late)

`npx tsc --noEmit` passes. One new migration to run in Supabase:

1. **`migrations/033_products_services_catalog.sql`** — extends
   `line_item_templates` with `category` (default 'General'),
   `is_taxable`, `cost`, `photo_id`. Everything else this round uses
   tables that already exist.

All earlier migrations (030 / 031 / 032) should already be applied — if
not, run them first, in order.

### What shipped this round

- **Feedback importer, round 3 — finally landing**. Two real bugs
  fixed: (a) decimal scores ("4.5 stars") were silently failing the
  `int` column; now we pull the first numeric token and round. (b)
  composite dedupe key was `clientId::date`, so every undated row
  after the first collapsed into one bucket and got skipped; now the
  key includes `score` + a 60-char hash of the comment so distinct
  rows are distinct. Also auto-creates parent clients for feedback
  rows whose client isn't in the DB yet — same pattern the contacts
  and communications importers use.
- **Line-item photos.** Editor: per-row photo dropdown next to the
  Optional / Delete buttons, wired to a new
  `setLineItemPhotoAction`. Public quote page at `/q/<token>` now
  fetches `photos.storage_key` via the `quote_line_items → photos`
  join, mints signed URLs for the private storage bucket, and
  renders the thumbnail inline with each "What's included" row.
- **Quote "•••" more menu** on the quote detail. Send reminder SMS
  (OpenPhone; logs to `activity_log`), Print / PDF (opens the public
  quote in a new tab), Archive (flips status to expired + stamps
  `expired_at` — soft-delete for records Ronnie doesn't want to
  actually delete).
- **Products & Services catalog** at
  `/dashboard/settings/products`. Grouped by category with sections
  per group. Edit inline per row (title / description / category /
  unit / price / cost / margin % / taxable / active / sort order).
  Add row per category. Summary strip up top. The old
  `/dashboard/settings/line-items` page is still linked as a
  "quick edit" alternative.
- **Custom fields editor** at `/dashboard/settings/custom-fields`.
  Admin-only. Add text / number / date / yes-no / dropdown fields
  attached to clients, projects, or quotes. Auto-slugifies the label
  into a stable `key`. Select-type takes newline or comma-separated
  options. Inline edit + delete per row. (UI for rendering the
  custom fields on the detail pages themselves is a follow-up; the
  schema + admin editor are ready.)
- **Client balance summary block** on the client detail page. Four
  cells: Total invoiced / Paid to date / Outstanding / Last payment.
  Only renders when the client has ≥1 milestone, so lead-only
  records stay clean. "Last paid" also surfaces as sub-copy under
  the Open balance stat in the summary strip.
- **Four new reports**:
  - `/dashboard/reports/team-productivity` — hours + visits +
    revenue attributed per crew member. Revenue splits pro-rata
    across assignees on a visit.
  - `/dashboard/reports/salesperson-performance` — quotes sent /
    accepted / pipeline $ / won $ / conversion rate per salesperson.
    Requires migration 032's `quotes.salesperson_id`.
  - `/dashboard/reports/client-reengagement` — clients whose last
    activity (accepted quote or completed project) is older than
    90 / 180 / 365 days. Tap-to-call + tap-to-email per row.
    Surfaces the right pool for a win-back SMS campaign.
  - `/dashboard/reports/properties` — every service address across
    every client with job count + active-job count. Bridges
    `client_properties` (explicit) with `projects.service_address`
    (implicit) and dedupes.
  - `/dashboard/reports/client-balance` — Jobber's "Client balance
    summary". Per-client total invoiced / paid / outstanding + last
    payment date.
- **Reports hub** now lists all seven reports as cards.

### What's still open (deliberately deferred this round)

- **Automations engine** — needs a proper rules table + trigger
  dispatcher + condition matcher. ~1 day of focused work; didn't
  fit in this window.
- **Route optimization** — needs a Google Maps Routes API key +
  billing sign-off from Ronnie before I can wire the fetch.
- **Push notifications** — needs a service worker, VAPID keys, and
  a subscription table. Deferred.
- **Monthly PDF statements** — no PDF renderer in the repo yet; the
  browser print-to-PDF trick works for change orders but a real
  statement needs a proper layout engine. Deferred.
- **Dark mode** — still requires a Tailwind `dark:` sweep across
  every component; scoped as its own focused PR.
- **Spanish i18n** — full string extraction + message catalog;
  scoped as its own focused PR.
- **Custom field rendering on detail pages** — the admin editor
  ships this round; the per-record render (show/edit the custom
  field values inline on the client/project/quote detail pages) is
  the next step.

### Your input needed

1. **Run migration 033** in Supabase, then re-upload the three
   Jobber CSVs (Client Contact Info, Client Communications, Customer
   Feedback). The Feedback importer should now process every row.
2. **Populate Products & Services** at
   `/dashboard/settings/products`. Existing line items default to
   `category=General`; re-categorize them so the catalog groups
   sensibly (Demolition / Driveway / Patio / etc.).
3. **Google Maps API key** — set `GOOGLE_MAPS_API_KEY` in Vercel if
   you want me to wire route optimization next round.
4. The Team Productivity report still uses **$45/hr** as the
   placeholder labor rate. If you want a real rate or per-crew
   rates, I'll wire a settings knob.

---

## ☕ WAKE-UP NOTE — overnight round 7 (2026-04-19)

`npx tsc --noEmit` is clean across the repo. Three migrations to run in
Supabase (order matters, all additive/idempotent):

1. **`migrations/031_business_profile_seed.sql`** — fills the Business
   Profile singleton with Ronnie's real info (**Rose Concrete and
   Development LLC**, **ronnie@sandiegoconcrete.ai**, **+1 619 537
   9408**, **License #1130763**, San Diego, CA). Uses `coalesce` so
   any hand-edit you made in `/dashboard/settings/business-profile`
   is preserved.
2. **`migrations/032_salesperson_timeline_expenses.sql`** — adds
   `quotes.salesperson_id`, `projects.salesperson_id`, quote
   timeline timestamps (`sent_at`, `viewed_at`, `email_opened_at`,
   `declined_at`, `expired_at`, `converted_at`), and a new
   `expenses` table + `expense_category` enum.
3. **(still pending from earlier)** `030_business_profile_work_settings.sql`
   if you didn't run it yet.

### What shipped tonight

- **All 3 broken importers fixed.**
  - **Contacts mapper** (`lib/jobber-import.ts::mapContactRow`):
    accepts Company / Contact / Customer / Business name / Display
    name as client_name aliases; falls back to splitting the Contact
    column into first/last; picks up Phone/Mobile/Cell/Home/Work/
    Contact Phone/Telephone, Email/Email Address/Primary Email/
    Contact Email, Billing Address/Street/Mailing Address. The
    action (`importContactsAction`) now **auto-creates** the parent
    client if it doesn't exist (cached per-run), so uploading
    Jobber's "Client Contact Info" CSV through the contacts import
    form produces 518 clients + 518 primary contacts even on a
    fresh DB. Run log includes the auto-created count.
  - **Communications mapper**: widened to Client/Company/Contact/
    Customer/To/From Client name aliases, more subject/body
    aliases (email_subject, email_body, text, preview, snippet,
    note, notes, message), more email address aliases (to, from,
    contact_email, recipient, sender), more date aliases. Auto-
    creates a client stub for unmatched rows.
  - **Feedback mapper**: widened the score aliases (star_rating,
    review_score, csat), comment aliases (feedback_comment,
    review_text, response, answer, body, message), client_name
    aliases (Company, Contact, etc.), score_type inference (stars
    column wins over range heuristic), date aliases
    (response_date, review_date, feedback_date).
- **Quote status timeline breadcrumbs** on `/dashboard/quotes/<id>`.
  Horizontal steps: Created → Sent → Viewed → Approved → Converted,
  plus a terminal Declined/Expired badge. Timestamps populate from
  `issued_at`, `sent_at` (stamped on `markQuoteSentAction`),
  `viewed_at` (stamped on first public-page render of `/q/<token>`),
  `accepted_at`, `converted_at` (stamped in `convertQuoteToJobAction`),
  `declined_at`, `expired_at`.
- **Salesperson assignment** on quotes. Dropdown added to the quote
  meta form, schema column on `quotes` + `projects` (mig 032). Also
  added a Title field to quote meta.
- **Expenses tracker** at `/dashboard/expenses`. Categories enum
  (materials, concrete, rebar, equipment rental, subcontractor,
  fuel, permit fee, labor, other), per-project assignment, vendor
  + paid-from + date + note. Summary strip: This month / Last 30d /
  YTD. Filter pills per category. Sidebar nav gained an Expenses
  link. Migration 032 adds the table + RLS.
- **Three canned reports** under `/dashboard/reports/*`:
  - **`/lead-source`** — leads-to-revenue per source with
    conversion-rate column and 30/90/365/all-time windows.
  - **`/timesheets`** — `visit_time_entries` aggregated per crew
    member with labor-cost estimate at $45/hr (placeholder rate).
  - **`/aged-receivables`** — unpaid milestones bucketed
    Current / 1–30 / 31–60 / 61–90 / 90+ days late with totals.
  All three linked from the Reports hub.
- **Batch invoicing** at `/dashboard/payments/batch`. Multi-select
  completed projects that still need QBO invoices; fires
  `autoInvoiceForApprovedQuote` per project in sequence; surfaces
  succeeded / skipped / failed counts inline. Link from the
  Payments page header.
- **Business profile seeded** with Ronnie's real details (see
  migration 031).

### What's still open

- P1: line-item photo attachments on quotes — deferred (needs a
  storage + signed-URL integration on the editor UI).
- P1: "••• more" menu on quotes/jobs — partially covered by the
  existing QuoteActions bar; full menu deferred.
- P2: Products & Services catalog (beyond the existing
  `/dashboard/settings/line-items`), Custom Fields editor,
  Automations engine — all still pending.
- P2: Requests & Bookings settings — still pending.
- P3: Team productivity, salesperson-performance,
  client-reengagement, properties reports — 3 of 8 reports
  shipped; the rest need another pass.
- P4: Route optimization — needs a Google Maps API key + budget
  approval before I wire it.

### Your input needed

- **Verify the seeded business profile** at
  `/dashboard/settings/business-profile` after running migration 031
  (tagline, bio, and street address are not set yet).
- **Re-upload the 3 Jobber CSVs** through
  `/dashboard/settings/import` — Client Contact Info (518 rows),
  Client Communications, Customer Feedback — and confirm the
  numbers now import.
- The Timesheets report uses **$45/hr** as a placeholder labor rate.
  If you want a different default rate, tell me and I'll wire a
  setting for it.

---

## 🆕 Round 6 shipped (2026-04-18) — quote-import resilience + more Settings

### Migrations to run (Supabase SQL editor)

- `migrations/030_business_profile_work_settings.sql` — creates
  `business_profile` and `work_settings` singleton rows with sensible
  defaults (9am–5pm Mon–Fri, 60 min default visit, 15 min buffer,
  America/Los_Angeles).

### What's new

- **Quotes importer auto-creates placeholder projects.** If a quote
  row references a client name that resolves but that client has no
  existing project, the importer spins up a one-off project
  (status=lead, name="Imported quote #N (no linked job)") and points
  the quote at it. One placeholder per client per CSV run (cached
  locally) so 50 historical quotes for the same customer produce one
  placeholder, not 50. Placeholders show up under
  `/dashboard/projects?status=lead` for clean-up later.
- **Quote orphan fallback → review queue.** When even the client
  can't be fuzzy-matched, the row is staged in
  `import_review_rows` with its top-3 suggested clients. The
  review page (`/dashboard/settings/import-review`) handles both
  kind=`project` and kind=`quote` — the quote resolver creates a
  placeholder project under the picked client + inserts the quote.
- **Business Profile settings** at `/dashboard/settings/business-profile`.
  Company name, legal name, tagline, client-hub bio, phone, email,
  website, full address, license #, public-listing toggle,
  keep-address-private toggle, and 7-day business hours editor.
- **Work Settings** at `/dashboard/settings/work`. Default visit
  duration (15–1440 min), buffer between visits (0–240 min), first
  day of week, timezone (IANA id), and 7-day working-hours editor
  anchoring the schedule page's Day view.
- **Manage Team** at `/dashboard/settings/team`. Role editor
  (admin / office / crew), inline full-name editing, invite form
  that calls `supabase.auth.admin.inviteUserByEmail` + upserts the
  profile row so role/name apply immediately on invite accept.
  Self-demotion + self-removal are blocked.
- **Fixed stray `phoneNumber` reference** in
  `/api/debug/openphone/route.ts` to match the adapter's renamed
  `number` field (the live OpenPhone API returns `number`, not
  `phoneNumber` — this was already fixed in the adapter but the
  debug route lagged).

---

## 🆕 Round 5 shipped (2026-04-18) — Jobber-parity gap push

Triggered by the 840-line Cowork audit at
`../automate my concrete business./Jobber Export/jobber-feature-audit.md`.
All of the following typecheck (`npx tsc --noEmit`) and are in repo:

### Migrations to run (Supabase SQL editor)

- `migrations/029_message_templates.sql` — creates `message_templates`
  (slug, label, email subject/body, sms body, toggles) and seeds eight
  defaults: `quote_sent`, `quote_approved`, `visit_reminder_24h`,
  `visit_reminder_1h`, `payment_due_reminder`, `review_request`,
  `on_my_way`, `booking_confirmation`. Merge-token syntax is
  `{first_name}` etc — renderer in `lib/templates.ts` leaves unknown
  tokens literal so typos are visible.
- `migrations/028_service_type_marketing_expansion.sql` — run if not
  yet applied (added earlier this session).

### What's new

- **Jobber-style 4-card dashboard pipeline summary** at the top of
  `/dashboard`. Requests / Quotes / Jobs / Invoices cards, each with a
  headline count + dollar value + two sub-rows. Every number links
  to the appropriate filtered list. Colored accent stripe per card
  matches Jobber's amber/fuchsia/emerald/sky scheme.
- **Requests module** at `/dashboard/requests`. Filter pills for New
  / Overdue (>48h) / Contacted / Qualified / Converted / Lost / All
  with live counts. Each row shows contact info (tap-to-call /
  tap-to-email / tap-to-maps), service type, message, age, and
  inline status-transition buttons (Mark contacted → Qualified →
  Converted / Lost / Reopen). Source filter + search.
- **Pipeline kanban** at `/dashboard/pipeline`. Seven-column board:
  Request → Contacted → Assessment → Quote drafted → Awaiting
  response → Approved → Won. Reads from `leads`, `quotes`, and
  `projects` tables so every open deal shows up once in the right
  column. Column total $ values roll up.
- **Universal "+ Create" menu** in the top bar. Drop-down with
  Client / Job / Quote / Visit / Task / Change order / Concrete
  order / Share booking-form link. Closes on outside click / Esc.
- **Global search** in the top bar, with `/` keyboard shortcut. New
  `/api/search` endpoint queries clients, jobs, quotes, and requests
  in parallel and returns up to 5 hits per type. Arrow-key
  navigation + Enter to open.
- **Properties CRUD** on client detail page. Add / edit / delete
  with inline forms; Google Maps link per property.
- **Contacts CRUD** on client detail page. Spouse / Billing /
  Property manager — with phone + email click-to-action, primary
  flag that enforces the one-primary invariant.
- **"Create similar quote"** button on quote detail. Clones the
  source quote + every line item into a new draft with a fresh
  quote number and public token.
- **"Text booking confirmation"** button on project detail. Looks up
  the next scheduled visit, SMS's the client a confirmation via
  OpenPhone, logs to activity_log. Falls back gracefully if
  OpenPhone not wired.
- **Email & SMS templates settings page** at
  `/dashboard/settings/templates`. Collapsible cards per template;
  edit subject / email body / SMS body / active toggle / per-channel
  toggles; live merge-token reference table; saved-state feedback.
- **Sidebar nav** — replaced "Leads" with "Requests" and added
  "Pipeline" to match the Jobber naming/layout.

---

## 🗂 Jobber-parity gap audit (from 2026-04-18 Cowork audit)

Source: `../automate my concrete business./Jobber Export/jobber-feature-audit.md` (840 lines). Below is every feature the audit documents, mapped against what we already ship, with status.

### ✅ Already shipped
- Core objects: Clients, Projects (= Jobber "Jobs"), Quotes, Milestones (= Invoices), Visits
- Multi-property + multi-contact schema (`client_properties`, `client_contacts`) — migration 021
- Tags on clients
- Lead source on clients (via `source` column)
- Lifetime value + open balance on client detail (Jobber-parity summary strip)
- Public token URLs: `/q/<token>` (quote), `/pay/<token>` (milestone), `/hub/<token>` (client hub), `/change-order/<token>`
- Dashboard stat cards
- Schedule Day / Week / Map views
- Task board (Kanban) — `/dashboard/tasks`
- Activity log — `/dashboard/activity`
- Notifications — `/dashboard/notifications` + header bell
- Two-way SMS — `/dashboard/messages`
- Online booking — `/book`
- Public lead webhook — `/api/public/lead`
- Change orders with finger signature + PDF — `/dashboard/change-orders`
- Sidewalk 11-step workflow — `/dashboard/workflows`
- Crew mobile: clock in/out GPS, tappable address, on-my-way SMS, required photo gate — `/crew`
- Crew job forms — `/crew/form`
- Concrete order group-SMS — `/dashboard/concrete-order`
- Status pill filter tabs on Projects / Quotes / Payments
- OpenPhone REST adapter (real SMS)
- Resend email adapter (real instant-response + reminder email)
- Payment-method lock on quote accept (check / ACH / card, locked totals)
- QBO auto-invoice on accept (gated)
- Import review queue (fuzzy suggestions)
- Shared `createLead()` pipeline
- Host-based middleware (sandiegoconcrete.ai → `/book`, app.* → dashboard)

### 🔨 Jobber features to build (ranked by visible impact)

**P0 — dashboard + list-page parity (highest UX value)**
- [x] Jobber-style 4-card dashboard pipeline summary ✅ round 5
- [x] `/dashboard/requests` list page ✅ round 5
- [x] `/dashboard/pipeline` kanban ✅ round 5 (7 columns)
- [x] Universal "+ Create" button ✅ round 5 (dropdown menu)
- [x] Global search bar with `/` shortcut ✅ round 5

**P1 — detail-page parity**
- [x] Properties CRUD on client detail ✅ round 5
- [x] Contacts CRUD on client detail ✅ round 5
- [x] "Create similar quote" duplicate button ✅ round 5
- [x] "Text booking confirmation" button on project detail ✅ round 5
- [x] Quote status timeline (Created / Sent / Viewed / Approved / Converted) ✅ round 7
- [x] Line-item image attachment on quotes ✅ round 8
- [x] Salesperson assignment on quotes + projects ✅ round 7
- [x] Quote "••• more" menu: Send reminder / Print / Archive ✅ round 8

**P2 — settings pages (mirror Jobber Settings sidebar)**
- [x] Business Profile (company info + hours for client hub) ✅ round 6
- [x] Products & Services catalog ✅ round 8
- [x] Email & SMS message templates with merge tokens ✅ round 5
- [x] Custom Fields schema UI ✅ round 8
- [x] Manage Team — users, roles, invitations ✅ round 6
- [x] Work Settings — default visit duration, working hours ✅ round 6
- [ ] Requests & Bookings — online booking form config
- [ ] Automations — trigger + action rules engine

**P3 — reports + modules**
- [x] `/dashboard/expenses` — expense tracker ✅ round 7
- [x] `/dashboard/reports/timesheets` — visit_time_entries aggregation ✅ round 7
- [x] `/dashboard/reports/aged-receivables` — 30/60/90+ days ✅ round 7
- [x] `/dashboard/reports/client-balance` — full balance list ✅ round 8
- [x] `/dashboard/reports/lead-source` — revenue by source ✅ round 7
- [x] `/dashboard/reports/team-productivity` ✅ round 8
- [x] `/dashboard/reports/salesperson-performance` ✅ round 8
- [x] `/dashboard/reports/client-reengagement` — 90/180/365 days ✅ round 8
- [x] `/dashboard/reports/properties` ✅ round 8
- [x] Batch invoicing on `/dashboard/payments` ✅ round 7
- [ ] Monthly statements per client

**P4 — deferred / requires infra**
- [ ] Route optimization (Google Maps Routes API)
- [ ] Receptionist AI (24/7 missed-call booking)
- [ ] Email marketing campaigns (Mailchimp-sized)
- [ ] Push notifications (native app or PWA + FCM)
- [ ] Dark mode (Tailwind `dark:` across every component)
- [ ] Full Spanish i18n

---

## ☕ WAKE-UP NOTE (2026-04-17, overnight build — Thomas)

Rolling through the 14-item punch list you left tonight. Everything below
this section typechecks (`npx tsc --noEmit`) and is ready for you to run
the new migration and sanity-check in the browser. The earlier
2026-04-16 note is preserved below for historical context.

### New migration to run (Supabase SQL editor)

- `migrations/027_service_type_expand.sql` — **extends the
  `service_type` enum** with 11 new values: retaining_wall, pool_deck,
  foundation, curb_and_gutter, slab, resurface, demo, steps, footings,
  walkway, fence_post_footings. Enum additions can&apos;t share a
  transaction with other DDL — run this one alone. After running,
  `lib/service-types.ts` is the authoritative list for booking form,
  webhook validator, and UI labels.
- `migrations/026_import_review.sql` — **staging table for CSV rows that
  couldn&apos;t auto-match a client/project.** Additive/idempotent. Adds
  `import_review_rows` with suggestions JSON so Ronnie can see the
  top-3 candidates at `/dashboard/settings/import-review` and resolve
  them with one click.
- `migrations/025_qbo_auto_invoice_flag.sql` — **seeds the new
  `qbo_auto_invoice` feature flag (default OFF).** Flip to ON from
  `/dashboard/settings/qbo-payments` once `QBO_ACCESS_TOKEN` +
  `QBO_REALM_ID` are set in Vercel.
- `migrations/024_quote_payment_lock.sql` — **adds the payment-method lock
  + ACH fee config.** Additive/idempotent. Extends the `payment_method`
  enum with `'ach'`, adds `ach_fee_*` columns to `invoice_settings`, and
  adds `locked_payment_method` / `locked_base_total` / `locked_fee_amount`
  / `locked_total_charged` / `locked_at` to `quotes`. Run this before any
  customer hits `/q/<token>` after this deploy; the fallback code
  gracefully degrades against pre-024 databases but only the full schema
  records what the customer picked.
- `migrations/023_task_board.sql` — **must run before `/dashboard/tasks`,
  `/dashboard/concrete-order`, or `/dashboard/change-orders` work.** It:
  - extends `public.tasks` with `assignee_id`, `priority`,
    `kanban_column`, `sort_order`, `quote_id`;
  - adds `task_templates` (seeds 5 default post-approval tasks);
  - adds `concrete_order_contacts` (seeds **Willy / Roger / Michael**
    with `+10000000001/2/3` placeholder phones — **update these to the
    real numbers at `/dashboard/concrete-order` before sending group
    texts**);
  - adds `concrete_orders` log table;
  - adds `change_orders` + `public_token` for customer signature;
  - extends `job_form_templates` and `job_form_instances` with `kind`,
    `photos_required/captured`, `submitted_at/by`;
  - adds `gmail_watched_senders`.

All prior migrations (009–022) still need to be run if they were not
already; the 2026-04-16 note below lists them in order.

### What's newly shipped (2026-04-18 round 4) — lead pipeline + host routing

- **Shared `createLead()` pipeline** at `lib/leads.ts`. Single entry
  point for every lead-intake path. Handles: idempotency (external_id or
  phone+source within 1h), client resolution (phone → email → stub
  insert), project stub in status=lead, draft quote, audit `leads` row,
  follow-up task on Ronnie&apos;s queue with priority=high + kanban
  todo, in-app notifications for every admin/office profile, activity
  log entry, and instant-response SMS (OpenPhone) + email (Resend).
  Best-effort on the comms — a failure never blocks the pipeline.
- **Lead webhook + /book form + OpenPhone unknown-number cron** all
  refactored to delegate to `createLead()`. A web form submit, a
  ring-in to the OpenPhone line, and a Duda webhook now produce an
  identical lead record + follow-up queue state.
- **Resend email adapter** at `lib/email.ts`. Env-gated:
  `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + optional `RESEND_REPLY_TO`.
  `getEmailAdapter()` picks real vs stub. The payment + visit + review
  reminder crons already used `createDefaultSenders()` — flipping on
  Resend now lights up automated email on all three paths without any
  further code change.
- **Service-type enum expanded** to 19 total values via migration 027.
  Booking form, import validators, and UI labels all read from
  `lib/service-types.ts`, which stays in lockstep with the enum.
- **Host-based middleware** at `middleware.ts`:
  - `sandiegoconcrete.ai` + `www.sandiegoconcrete.ai` rewrite `/` →
    `/book` so the bare domain is the quote request page (no URL
    bar flicker).
  - Public paths (`/book`, `/q/*`, `/pay/*`, `/change-order/*`,
    `/hub/*`, `/embed/*`, `/api/public/*`, `/api/webhooks/*`) pass
    through on the marketing host.
  - Dashboard / crew / login / auth paths on the marketing host 302
    to `app.sandiegoconcrete.ai/...` so Ronnie&apos;s browser ends up
    on the right surface automatically.
  - localhost + *.vercel.app bypass the split so dev + preview builds
    expose the whole app on a single URL.
- **OpenPhone adapter honors `OPENPHONE_PHONE_NUMBER_ID`.** When set,
  all sends + backfill polls are scoped to that one phoneNumberId.
  Invalid id falls back to the full number list with a console.warn so
  a typo doesn&apos;t silently stop SMS.

### Env vars to set for the lead pipeline end-to-end

```
# Instant SMS response (already documented; user confirmed set)
OPENPHONE_API_KEY
OPENPHONE_PHONE_NUMBER_ID

# Instant email response (new this round)
RESEND_API_KEY
RESEND_FROM_EMAIL       # e.g. "Rose Concrete <hello@sandiegoconcrete.ai>"
RESEND_REPLY_TO         # optional, defaults to RESEND_FROM_EMAIL
```

### How to test the lead pipeline end-to-end

1. Run migration 027 in Supabase.
2. Ensure `lead_webhook` feature flag is enabled (already the case on
   prior databases; insert a row if missing).
3. Set `LEAD_WEBHOOK_SECRET`, `OPENPHONE_API_KEY`,
   `OPENPHONE_PHONE_NUMBER_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
4. Hit any of the three intake paths:
   - `curl -X POST http://localhost:3000/api/public/lead \\` \
     `  -H "x-rose-secret: $LEAD_WEBHOOK_SECRET" \\` \
     `  -H "content-type: application/json" \\` \
     `  -d '{"name":"Test","phone":"619-555-0100","service_type":"retaining_wall","message":"Need a wall"}'`
   - Open `/book`, fill the form, submit.
   - Call or text the OpenPhone line from a number not in `clients.phone`;
     wait for the next `/api/cron/openphone-backfill` tick.
5. Verify in the dashboard:
   - `/dashboard/leads?status=new` shows the lead with the right source
   - `/dashboard/clients` shows the stub (or matched) client
   - `/dashboard/projects?status=lead` shows the auto-created project
   - `/dashboard/quotes?status=draft` shows the half-built quote
   - `/dashboard/tasks` shows a priority=high "Call back …" task
   - `/dashboard/notifications` shows a `new_lead` push for every
     admin/office profile
   - `/dashboard/activity` shows `lead_captured`
   - `leads.responded_at` populated and `leads.status='contacted'` if
     either SMS or email adapter accepted the send
6. Confirm the marketing host routing: the middleware at
   `middleware.ts` rewrites `/` → `/book` on the marketing host and
   bounces `/dashboard*` to `app.*`. localhost keeps the full app on
   one URL.

### What's newly shipped (2026-04-18 round 3) — real-data every-page push

- **Leads pipeline at `/dashboard/leads`.** New list page with
  status-pill filter tabs (new / contacted / qualified / converted / lost
  — each showing live count), text search across name/phone/email/
  address, tappable `tel:` / `mailto:` / maps links on every row. Each
  row has a shortcut to bump to the next pipeline stage, a one-click
  "Convert → client" action that creates the client record from the
  lead&apos;s contact info and redirects into the new client page, and a
  "Mark lost" escape hatch. Added to the sidebar nav (between Schedule
  and Clients) and the dashboard&apos;s "New leads (7d)" KPI card now
  links straight into the filtered list. Fills in the last dead
  drill-in on the dashboard.
- **Reports page is now a real hub.** Tabbed view with four reports,
  each hitting the DB live:
  - **Revenue** — service-type and lead-source breakdowns (365d), same
    as before but now one tab among many
  - **Conversion** — quote funnel for 90d + 365d: quotes issued,
    accepted, declined, expired, acceptance rate %, avg time to close
    (days from issued → accepted), avg accepted value
  - **Timesheets** — per-crew weekly totals pulled from
    `visit_time_entries`, with an "open shifts" flag for anyone still
    clocked in, plus per-entry detail with GPS-stamped clock-in times
  - **Profitability** — top 50 projects by tightest margin first, pulled
    from `revenue_cached` / `cost_cached` / `margin_cached`; totals
    strip across the top
- **Crew mobile — Forms tab in bottom nav.** `/crew/form` was already
  wired but unreachable from the bottom nav; added the 📝 Forms tab
  between Upload and the edge. Crew schedule week view now also shows
  tappable address (Google Maps) and tappable client phone (📞 Call
  pill) on every visit — matches the Today page.
- **Reports hub** replaces the previous minimal reports page — the old
  layout stays as the default "Revenue" tab.

### What's newly shipped (2026-04-18 round 2) — fuzzy matching + Jobber-parity push

- **Fuzzy matcher now handles typos.** `lib/fuzzy-match.ts` gained a
  Levenshtein-distance tier as a last resort — catches single-character
  typos like "Smithe" vs "Smith", "Ronalds" vs "Ronald", dropped
  letters. Only fires when exactly one candidate is within edit
  distance ≤2 AND that candidate is at least 2 edits closer than the
  runner-up (so we never silently assign jobs to the wrong similar
  customer). Also exposes `.suggest(rawName, 3)` which returns ranked
  "did you mean…" candidates for the review UI.
- **Import review queue at `/dashboard/settings/import-review`.** Every
  CSV row that can&apos;t auto-match now stages into
  `import_review_rows` with its top-3 fuzzy suggestions. Admin clicks
  one of the suggestion pills or picks from the full client list, and
  the project gets created with the staged payload. Dedupe by payload
  hash so re-running the same CSV doesn&apos;t duplicate pending rows.
  Filter pills for pending / resolved / dismissed / all. The 16
  orphaned jobs should now either auto-match on re-upload (Levenshtein
  catches typos the prior matcher missed) or land in the review queue
  with a "did you mean" for each.
- **Client detail — Jobber-style summary strip.** Four cards above the
  main grid: Lifetime value, Open balance (highlighted amber when
  &gt;0), Active jobs (with total count), and Next/Last visit (whichever
  is applicable). Open balance pulls unpaid milestones across every
  project for that client.
- **Schedule — Day view.** New Day / Week / Map tab triggers on the
  schedule page. Day view renders an hour-by-hour column (6a–8p) with
  each visit placed at its scheduled time + duration, Jobber-style.
  Visits scheduled outside 6a–8p show in a &quot;before / after hours&quot;
  strip at the top so nothing&apos;s ever hidden. Nav arrows respect the
  active view (prev/next day vs prev/next week). Dashboard&apos;s
  &quot;Today&apos;s jobs&quot; widget now links straight to the day view.
- **Settings landing** — added links to Import review queue.

### What's newly shipped (2026-04-18) — QBO auto-invoice + Jobber polish

- **Auto-fire QBO invoice on quote accept.** `acceptQuoteAction` now
  calls `autoInvoiceForApprovedQuote` after seeding the payment
  schedule. Gated by the `qbo_auto_invoice` flag (off by default). Uses
  the locked total so the QBO invoice matches the customer&apos;s signed
  amount to the penny. Logs every fire into `activity_log` with action
  `invoice_auto_created` + the QBO invoice number + pay-now URL if the
  adapter returned one. **Never throws** — a QBO hiccup can never block
  a customer from accepting their quote; we just log and move on.
- **Real QBO REST adapter** at `lib/qbo/invoices.ts::createQboRestAdapter`.
  Uses OAuth 2.0 Bearer token, QBO Online API v3. Does a customer
  lookup by DisplayName, creates the customer if missing, then POSTs
  the invoice with one line per schedule milestone and the correct
  OnlinePayment toggles for whatever method the customer locked in
  (check → Pay Now off; ACH/card → Pay Now on). `getQboInvoiceAdapter`
  picks real vs stub automatically based on env. `qboIsConfigured()`
  exposes the state so the auto-invoke path can skip cleanly when
  creds aren&apos;t set.
- **QBO Payments settings page** at `/dashboard/settings/qbo-payments`.
  Shows connection status, env (sandbox/production), inline toggle for
  the `qbo_auto_invoice` flag, a recent-invoice activity feed, and
  copy-pastable env var names for Vercel. Added to the settings
  landing page.
- **Jobber-style list page polish.** Introduced a shared
  `StatusPillLink` primitive (rounded-pill filter nav). Applied to
  `/dashboard/projects` (All + every project status), `/dashboard/quotes`
  (All + draft/sent/accepted/declined/expired), `/dashboard/payments`
  (Open/Paid/All). Payments page also gained a three-card summary
  strip (Open / Overdue / Collected in last 30d) matching Jobber&apos;s
  billing overview.

### Env vars to set for the QBO Pay Now flow

```
QBO_ACCESS_TOKEN   # OAuth 2.0 access token from Intuit
QBO_REALM_ID       # your company id
QBO_ENV            # 'sandbox' or 'production' (defaults to production)
```

Until those land, `qboIsConfigured()` returns false and the auto-invoice
call silently skips (status &quot;not_configured&quot; shows up in the server
log). Flip the `qbo_auto_invoice` flag + set the three env vars + redeploy
= next quote accept fires a real QBO invoice.

### What's newly shipped (2026-04-17 follow-on) — payment-method lock

- **Three-way payment selector on the public quote page.** `/q/<token>`
  now shows Check / ACH / Credit card side-by-side with live totals and
  per-option fee breakdown (base + fee + total). The customer picks one,
  the card highlights with a ✓, then they scroll down and sign. The
  Accept button is disabled until a method is picked and surfaces the
  exact total they&apos;re locking in.
- **Method + total locks with the signature.** On accept the server
  recomputes the fee (never trusts the client), writes
  `quotes.locked_payment_method / locked_base_total / locked_fee_amount /
  locked_total_charged / locked_at`, and stamps the signed-by name + IP
  alongside. An already-accepted quote returns a clear error — no
  re-signing, no switching methods.
- **ACH as a first-class method.** New `'ach'` enum value + default $10
  flat fee (configurable at `/dashboard/settings/invoicing`). The old
  per-milestone pay page at `/pay/<token>` now shows all three options
  too, and the admin milestone card mirrors that view for Ronnie.
- **Invoice settings page rebuilt** to manage card + ACH fees + check
  instructions in one place, with a live $10,000 preview showing what
  each method costs the customer.
- **Payment schedule seeding carries the lock through.** When a quote is
  accepted, the deposit + final milestones inherit the locked method and
  the fee is prorated across them so the per-milestone `total_with_fee`
  values sum to the locked total — the QBO invoice uses those
  `total_with_fee` numbers so it matches the signed total to the penny.
- **Signed confirmation block** on both the public quote page and the
  admin quote editor shows the locked method, base, fee, total, and the
  signer&apos;s name + timestamp — so Ronnie sees exactly what the
  customer agreed to without digging into the activity log.

### What's newly shipped tonight (2026-04-17)

- **Fuzzy client-name matching on every Jobber import** — `lib/fuzzy-match.ts`
  wires into projects/quotes/visits/contacts/communications/requests/feedback.
  Matches exact name, aggressive-normalized name (LLC/&/punct stripped),
  unique substring, and ≥50% token-overlap. The 16 orphaned jobs you
  flagged should now find their clients; re-run the import.
- **Visits CSV can now match by client name + date** when Job # is
  missing (previously required Jobber's "Job #"). `lib/jobber-import.ts`
  updated to make `external_job_id` optional.
- **Task board at `/dashboard/tasks`** — drag-drop Kanban (To Do →
  In Progress → Review → Done), auto-seeds tasks from
  `task_templates` when a quote is accepted (see
  `app/q/[token]/actions.ts::seedTasksForQuote`). Inline edit,
  priority badges, due-date chips, assignee dropdown, delete with
  confirm.
- **Concrete order template at `/dashboard/concrete-order`** — pre-fills
  message from project + pour date + PSI/slump/yards/mix notes, fans
  out via OpenPhone to Willy/Roger/Michael (configurable). Saves a
  structured `concrete_orders` row on every send with per-recipient
  OpenPhone refs. Draft save works even when OpenPhone is unwired.
- **Change orders at `/dashboard/change-orders`** — mobile-friendly
  create flow, per-project auto-numbering, customer sign page at
  `/change-order/<token>` (finger signature pad, canvas → PNG data URL),
  photo upload (mobile camera capture), printable PDF at
  `/dashboard/change-orders/<id>/print` (browser "Save as PDF").
- **Sidewalk workflow Gmail auto-forward** —
  `/dashboard/settings/gmail-watch` is now the source of truth for
  "emails from these senders route to the single active sidewalk
  project." Wired into the existing `gmail-permit-scan` cron. Template
  (the 11-step ladder) already existed in migration 017.
- **Pre-inspection / completion / custom crew forms** — `/crew/form`
  lists job-form templates scoped to the project's service_type,
  opens a mobile-friendly filler that saves drafts, enforces required
  fields on submit, and stamps `submitted_at` / `submitted_by`.
- **Automated reminders now go through real OpenPhone** — added
  `createDefaultSenders()` in `lib/reminder-senders.ts`, swapped into
  `payment-reminders`, `visit-reminders`, and `review-requests` crons.
  When `OPENPHONE_API_KEY` is set, SMS goes out; otherwise the cron
  silently skips (correct behavior, no crash). Email still stubbed
  until Gmail OAuth lands.
- **Crew mobile app hardened** — `/crew` now has:
  - tappable address (opens Google Maps)
  - one-tap 📞 Call button on the client row
  - On-my-way inline widget with ETA picker (fires existing
    `sendOnMyWayAction`)
  - **completion photo required** before mark-done (checks
    `attachments` for an image on the project)
  - link to 📝 job forms scoped to the visit/project
- **Change orders + Concrete order in sidebar nav** (between Tasks and
  Payments).

### What still needs your input

1. **Concrete order contacts** — the seed phones are placeholders
   (`+10000000001/2/3`). Go to `/dashboard/concrete-order` → "Default
   recipients" and put the real Willy / Roger / Michael numbers in, or
   delete and re-add with the real ones.
2. **Gmail watch list** — add the City of San Diego survey / permit
   addresses at `/dashboard/settings/gmail-watch` so the sidewalk
   Gmail-auto-forward routes correctly. Today it falls back to "if
   exactly one active sidewalk project exists, route there."
3. **OpenPhone API key** — without it, the concrete order / payment
   reminders / visit reminders / review requests all silently no-op.
   Same deal as before.
4. **APP_BASE_URL** — needed for the change-order customer sign link
   (`/change-order/<token>`). The dashboard detail page shows a
   warning when it's unset.
5. **Legacy task rows from 2026-04-16** — those had `status` in
   `(open, done, dismissed)` with no `kanban_column`. Migration 023
   backfills `kanban_column='done'` for `status='done'`, and
   everything else lands in `todo`. Anything `status='dismissed'` is
   hidden from the board (my query filters it out). No action needed
   unless you want to un-dismiss historical missed-call tasks.

### Typecheck

`npx tsc --noEmit` passes cleanly across the whole repo.

### Not shipped tonight

- **Live-map / dispatch board** — still deferred; requires mobile
  background geolocation.
- **Duda portfolio auto-publish** — deferred until Duda creds.
- **Batch invoicing UI** — still needs a scoped `invoices` table
  redesign first.
- **Dark mode / Spanish** — unchanged from prior note.

---

## ☕ WAKE-UP NOTE (2026-04-16, overnight build in progress)

Thomas asked me to build through the night on the 28-item Jobber-parity
list. Working in priority order by value × feasibility. Progress log is
the **"Overnight 2026-04-16"** section below this note. I'll keep both
up to date as I go.

### Migrations to run (in order, in Supabase SQL editor)

Run any new ones you haven't run yet. All additive / idempotent.

- `018_jobber_extra_imports.sql` — contacts, communications (adds
  email channel), requests, feedback. Already noted earlier; include
  if skipped.
- `019_jobber_api_dedupe.sql` — `external_id` on notes and
  attachments for the Jobber GraphQL importer.
- `020_jobber_oauth.sql` — the Jobber OAuth token row.
- `021_jobber_parity_batch_1.sql` — **the overnight omnibus**.
  Covers: `notifications`, `client_properties`, `discount_codes`,
  `tax_rates`, `custom_field_definitions` + `custom_field_values`,
  `job_form_templates` + `job_form_instances`, `dashboard_prefs`,
  `automation_config`, `automation_runs`, plus new columns on
  `clients`, `projects`, `quotes`, `communications`, `leads`,
  `profiles`. If `alter type comm_channel add value 'email'` errored
  earlier (from 018), run that one statement separately first.

### Env / secrets needed

- `APP_BASE_URL` — still required for the client hub public links, the
  Jobber OAuth redirect, and the lead webhook. Set it if you haven't.
- `OPENPHONE_API_KEY` — required for real two-way SMS (inbox will
  show empty without it; the send path silent-skips).
- `LEAD_WEBHOOK_SECRET` — used by the existing public lead endpoint.
  The online-booking form reuses this.

### Ronnie's input needed

Any item in the log below tagged **⚠ NEEDS INPUT** needs a call.
Typical answers I had to guess at and will want confirmed:

- Default post-job follow-up cadence: thank-you same day, Google
  review at +3 days, check-in at +30 days. Tell me to change any of it.
- Quote follow-up cadence: +3 days, +7 days, +14 days → cold.
- Default tax rate (I punted on 0 %; set the real one at
  `/dashboard/settings/tax`).
- Google review URL (stored in receipt settings table; fill in before
  the review-request cron fires).

### What's intentionally deferred (not in the overnight batch)

- **Mobile push notifications** — needs Expo / FCM and a native app
  shell; not doable purely in the Next.js codebase overnight.
- **Spanish i18n** — needs full string extraction across every
  component; safer as its own focused PR than overnight work.
- **Dark mode** — Tailwind `dark:` classes across every component;
  similar scope argument.
- **Full email marketing** — bulk sender with template library and
  CAN-SPAM compliance is a Mailchimp-replacement-sized project.
- **Crew mobile push / GPS live map** — same Expo dependency.

---

## 🌙 Overnight 2026-04-16 — Jobber parity batch 1

Status through the night. Shipped = code in repo + builds clean; migration
listed once under **Migrations**. Marked ⚠ where Ronnie's input is needed
to actually make the feature useful.

### ✅ Shipped

- **Migration 021** — `021_jobber_parity_batch_1.sql`, omnibus for the
  whole batch. Tables: `notifications`, `client_properties`,
  `discount_codes`, `tax_rates`, `custom_field_definitions`,
  `custom_field_values`, `job_form_templates`, `job_form_instances`,
  `dashboard_prefs`, `automation_config`, `automation_runs`. Columns:
  `clients.hub_token` / `referred_by_client_id`,
  `projects.recurrence_*` / `property_id` / `invoice_*`,
  `quotes.discount_code_id` / `discount_amount` / `tax_rate_id` /
  `tax_amount`, `communications.read_at`,
  `leads.referred_by_client_id`, `profiles.permissions`. All additive.

- **Client Hub (customer portal)** — `/hub/<token>` shows the client
  their jobs, open quotes (with approve links via existing
  `/q/<token>`), payment milestones (with pay links via existing
  `/pay/<token>`), message thread with reply form, and file upload.
  Each client auto-gets a `hub_token` on migration run. Public page,
  no login. `app/hub/[token]/*`, `lib/hub.ts`.

- **Online Booking** — `/book` public form. Creates a `clients` stub +
  `leads` row, sends confirmation SMS (no-ops without
  `OPENPHONE_API_KEY`), pushes `new_lead` notifications to admin+office.
  Embeddable on the marketing site. `app/book/*`.

- **Two-way SMS inbox** — `/dashboard/messages` lists conversations
  with unread badges. `/dashboard/messages/<clientId>` shows the
  thread + reply form that sends via OpenPhone and logs an outbound
  `communications` row. Marks inbound as read on view.
  `app/dashboard/messages/*`.

- **Notifications** — `notifications` table + `NotificationBell`
  component in the dashboard header + `/dashboard/notifications` page
  that marks everything read on view. `components/notification-bell.tsx`,
  `app/dashboard/notifications/*`.

- **Activity feed** — `/dashboard/activity` pulls from the existing
  `activity_log` table with filters for `entity_type`, `entity_id`,
  `actor_id`. `app/dashboard/activity/*`.

- **Quote follow-up cron** — `/api/cron/quote-followups`, daily at
  23:00 UTC. Reads cadence from `automation_config`. Sends SMS at +3
  and +7 days (configurable), marks quote `expired` at +14 days.
  Idempotent via `automation_runs`. **⚠ Defaults 3/7/14 — confirm at
  `/dashboard/settings/automations`.**

- **Post-job follow-up cron** — `/api/cron/postjob-followups`, daily
  at 00:00 UTC. For every completed project: thank-you at +0 days,
  review request at +3 days (includes `review_url` if set), check-in
  at +30 days. **⚠ Set the Google review URL at
  `/dashboard/settings/automations` — review SMS won't include a link
  until then.**

- **Recurring jobs cron** — `/api/cron/recurring-jobs`, daily at
  13:00 UTC. For any project with `recurrence_cadence` set and
  `recurrence_next_at <= now()`, creates the next visit and advances
  the cursor by the cadence (weekly=7, biweekly=14, monthly=30,
  quarterly=90, yearly=365, custom=`recurrence_interval_days`).

- **Settings: Automations** — `/dashboard/settings/automations`. Admin
  form to tune cadence days + review URL. Writes to
  `automation_config`.

- **Settings: Tax rates** — `/dashboard/settings/tax`. Add/delete
  tax_rates rows with `is_default` toggle. **⚠ Add "San Diego County
  7.75%" (or whatever the real rate is) here before sending any
  taxed quotes.**

- **Settings: Discount codes** — `/dashboard/settings/discount-codes`.
  Add percent-off or amount-off codes, toggle active/inactive. Codes
  surface in the quote editor (wiring is TODO — see below).

- **Nav updates** — sidebar now has Messages + Activity. Notification
  bell lives in the top bar of every dashboard page.

- **Dashboard widgets** — the `/dashboard` home now shows three new
  widget strips below the KPI cards: **Today's jobs** (pulls visits
  scheduled for today), **Unpaid invoices** (pending/sent/overdue
  `payment_milestones`), **Recent messages** (last 6 communications
  with unread dots). Existing profitability snapshot is preserved.

- **Settings: Job forms** — `/dashboard/settings/job-forms`. Admin
  creates checklist templates (pre-inspection / safety / completion /
  custom). Items parsed from `type | label` lines with `*` prefix to
  require. Templates are then ready to be attached to a project
  instance (the attach UI on the project page is in the in-progress
  list below).

- **Settings landing updated** — `/dashboard/settings` now lists the
  four new admin pages (Automations, Tax rates, Discount codes, Job
  forms) alongside the existing modules.

### ⚠ Needs Ronnie's input before it works

1. **Fill in `/dashboard/settings/automations`**: confirm the 3/7/14
   quote follow-up cadence, the 0/3/30 post-job cadence, and paste
   the Rose Concrete Google review URL. Without the review URL the
   review-request SMS goes out without a link.

2. **Fill in `/dashboard/settings/tax`**: add at least one tax rate,
   mark it default. Otherwise `quotes.tax_amount` stays at 0.

3. **Rotate `APP_BASE_URL`**: the Client Hub link, online-booking
   embed, and OAuth callbacks all depend on it.

4. **Set `OPENPHONE_API_KEY`** for real SMS on follow-ups, two-way
   inbox, and booking confirmations. Without it everything silently
   no-ops (correct behavior, but nothing ships).

### 🚧 Still in progress overnight (check commit order)

The following were planned for tonight but may or may not have made
it before context ran out. Anything missing here needs finishing:

- **Multi-property clients UI** — table exists (`client_properties`,
  `projects.property_id`); needs a CRUD tile on the client detail page.
- **Recurring-job setup UI** — columns exist on `projects`; needs a
  small form on the project detail page to set cadence + next_at.
- **Expense tracking UI** — `job_costs` table already carried through
  from Phase 1; needs a tab on the project detail page.
- **Time tracking UI** — `visit_time_entries` already exists; needs
  a timesheet report at `/dashboard/reports/timesheets`.
- **Route optimization** — the schedule map view already shows stops
  per day; route ordering is currently CSV order, should be
  nearest-neighbor from `clients.address` lat/lng lookup.
- **Referral tracking dropdown** — `clients.referred_by_client_id`
  exists; needs a typeahead on the client form.
- **Job forms / checklists UI** — tables exist; needs template editor
  and instance attach-to-project flow.
- **Custom fields UI** — tables exist; needs admin editor and render
  on client/project/quote forms.
- **Discount code + tax wire-up on quote editor** — the settings
  pages exist; the quote editor needs dropdowns to pick them.
- **Batch invoicing** — we don't yet have an `invoices` table; the
  current pay-link flow is per-milestone. Batch invoicing makes more
  sense after we add a proper `invoices` table (separate project).
- **Dashboard widget customization** — `dashboard_prefs` table
  exists; current dashboard already shows 4 of the 6 widget types
  (active jobs, open quotes, this-week visits, leads). Missing:
  unpaid invoices widget, recent messages widget, revenue chart,
  lead pipeline. Drag-to-reorder UI is deferred.

### 📋 Full Jobber-parity scorecard (Ronnie's 28-item list)

| # | Feature | Status |
|---|---|---|
| 1 | Client Hub | ✅ shipped — `/hub/<token>` |
| 2 | Online Booking | ✅ shipped — `/book` |
| 3 | Two-way SMS | ✅ shipped — `/dashboard/messages` + inbox thread view |
| 4 | Automated follow-ups | ✅ shipped — postjob cron (+0/+3/+30), configurable at `/dashboard/settings/automations` |
| 5 | Job forms & checklists | 🟡 partial — templates shippable at `/dashboard/settings/job-forms`; attach-to-project UI still TODO |
| 6 | Batch invoicing | 🔴 blocked — no `invoices` table yet; pay-link flow is per milestone. Needs a scoped follow-up |
| 7 | Invoice scheduling | 🟡 schema shipped (`projects.invoice_trigger`, `invoice_scheduled_for`); no UI or cron yet |
| 8 | Expense tracking | 🟡 table already existed (`job_costs`); UI tab on project page still TODO |
| 9 | Time tracking | 🟡 table already existed (`visit_time_entries` with GPS); timesheet report still TODO |
| 10 | GPS waypoints | 🟡 `visit_time_entries` has lat/lng on clock in/out; map UI deferred |
| 11 | Route optimization | 🔴 deferred — requires geocoding (Maps API key); schedule map view has per-day Google Maps link already |
| 12 | Recurring jobs | ✅ shipped — cron + `projects.recurrence_*` columns; UI to set cadence on a project is TODO |
| 13 | Job costing | 🟡 `job_costs` + `projects.revenue_cached/cost_cached/margin_cached` already existed; budgeted-vs-actual view deferred |
| 14 | Quote follow-up sequence | ✅ shipped — `/api/cron/quote-followups` at +3/+7, cold at +14, configurable |
| 15 | Referral tracking | 🟡 `clients.referred_by_client_id` + `leads.referred_by_client_id` shipped; form dropdown + report TODO |
| 16 | Email marketing | 🔴 deferred — Mailchimp-sized |
| 17 | Client tags & segments | 🟡 `clients.tags` column already existed; filter UI on clients list is TODO |
| 18 | Custom fields | 🟡 schema shipped (`custom_field_definitions` + `_values`); editor UI TODO |
| 19 | Notification center | ✅ shipped — bell in header + `/dashboard/notifications` |
| 20 | Mobile push notifications | 🔴 deferred — needs Expo / FCM + native app |
| 21 | Quote line item library | ✅ already existed (`line_item_templates` since migration 011) |
| 22 | Discount codes | 🟡 settings shipped at `/dashboard/settings/discount-codes`; quote editor wire-up TODO |
| 23 | Tax settings | 🟡 settings shipped at `/dashboard/settings/tax`; quote editor wire-up TODO |
| 24 | Multi-property clients | 🟡 schema shipped (`client_properties`, `projects.property_id`); CRUD UI TODO |
| 25 | Crew permissions | 🟡 role-based (`requireRole`) already worked; per-user override column shipped (`profiles.permissions`); UI TODO |
| 26 | Activity feed | ✅ shipped — `/dashboard/activity` using existing `activity_log` |
| 27 | Dashboard widgets | 🟡 Today's jobs + Unpaid invoices + Recent messages added to `/dashboard`; drag-to-reorder + `dashboard_prefs` wire-up TODO |
| 28 | Dark mode | 🔴 deferred — touches every component |
| *extra* | Spanish language | 🔴 deferred — full i18n extraction |

Priorities for the next session, in order of user-visible impact:
1. Quote editor: wire discount code + tax dropdowns (22, 23 finish)
2. Client tags filter on `/dashboard/clients` (17 finish)
3. Recurring-job cadence form on project detail page (12 finish)
4. Multi-property CRUD on client detail page (24 finish)
5. Job-form attach/fill flow on project detail + mobile (5 finish)
6. Batch invoicing — needs an `invoices` table first (6 needs design)

### 🛑 Intentionally deferred (not this batch)

- Mobile push notifications (needs Expo / FCM + native app shell).
- GPS live map of crew during a shift (needs a live layer on maps).
- Full email marketing (bulk sender + CAN-SPAM + template library is
  Mailchimp-sized).
- Dark mode (Tailwind `dark:` classes across every component).
- Spanish i18n (full string extraction — safer as a focused PR).
- Crew permissions UI — schema exists (`profiles.permissions jsonb`);
  defaults by role are still enforced in `requireRole`. Per-user
  overrides deferred.

---

## 🚀 Top priority (added 2026-04-15) — OpenPhone deep integration + workflows

Ronnie's directive: make every phone conversation automatically become structured
data in the app, give multi-step permit jobs their own workflow, and let every
record in the system hold photos/permits/contracts directly.

Build order is specific: **file attachments first** (everything below depends
on it), then multi-step workflows, then OpenPhone real sync, then AI scrubber.

### ✅ Shipped 2026-04-15

- **File attachments everywhere** — `migrations/016_attachments.sql`,
  `lib/attachments.ts`, `<AttachmentsPanel>`, mounted on client / project
  / quote detail pages. Client page rolls up files across its projects +
  quotes via `loadAttachmentsAcross`.
- **Sidewalk-permit workflow (Ronnie's exact 11 steps)** —
  `migrations/017_project_workflows.sql` seeds the template; tagging a
  project `service_type='sidewalk'` auto-creates all 11 steps with
  dependencies, responsible role, and SLA business-day due dates.
  `<WorkflowSteps>` on the project page enforces dependency gating in the
  UI; `updateWorkflowStepAction` enforces it server-side and auto-opens
  the next step when one closes. Per-step metadata fields collect
  `submission_date`, `permit_number`, `permit_approved_at`,
  `permit_expires_at`, `survey_sent_at`/`survey_received_at`, etc.
- **Workflows dashboard at `/dashboard/workflows`** — every active
  workflow project, current step, due date, progress bar, stale badge.
  Sidebar nav added.
- **Staleness reminder cron** at `/api/cron/workflow-stale` (daily, 5pm
  UTC). Flags any step pending/in_progress > 3 business days; writes
  idempotent ledger row in `workflow_stale_reminders`. Stale badge shows
  on the dashboard + project page right away.
- **Gmail → permit auto-attach cron** at `/api/cron/gmail-permit-scan`
  (every 15 min). Subject regex `permit|survey|sidewalk` + permit-number
  or sender-email match → attaches Gmail attachments to the matching
  active sidewalk project automatically. `lib/gmail.ts` adapter is
  stubbed; flips on when GMAIL_OAUTH_* env vars land.

### 1. File attachments everywhere (foundation — build first)
Every client, project, quote, task, and visit gets a files tray: photos,
permits, contracts, inspection reports, MOASURE screenshots. Supabase
Storage bucket `attachments`; polymorphic `attachments` table pointing at any
entity. Client page rolls up everything attached to its projects/quotes too.

- [ ] `migrations/016_attachments.sql` — `attachments` table
      (entity_type enum extended, entity_id, storage_key, filename,
      mime_type, size_bytes, caption, uploaded_by, created_at), Storage
      bucket `attachments` with admin/office write + authenticated read.
- [ ] `lib/attachments.ts` — upload/list/delete helpers (service-role
      signed-URL issuance for the private bucket).
- [ ] `app/dashboard/_actions/attachments.ts` — `uploadAttachmentAction`,
      `deleteAttachmentAction`, Zod-validated, role-gated.
- [ ] `<AttachmentsPanel entityType entityId>` — reusable widget:
      drag-drop upload, thumbnail grid for images, filename list for
      docs, caption edit, delete with confirm.
- [ ] Mount on client / project / quote / visit / task detail pages.
- [ ] Client page aggregates attachments across its projects + quotes.

### 2. Multi-step workflows (permit jobs + others)
Some project types require a fixed sequence — sidewalk permit jobs need
measure → permit application → permit approval → schedule crew → pour →
inspection → sign-off. Build a template system so tagging a project's
`service_type` auto-seeds the step list with dependencies. No step can flip
to done until the one before it is done.

- [ ] `migrations/017_project_workflows.sql` —
      `workflow_templates (service_type unique, name, steps jsonb)`,
      `project_workflow_steps (project_id, sequence, title, status,
      depends_on_sequence, completed_at, completed_by, due_date)`.
- [ ] Seed sidewalk-permit template with all 7 steps.
- [ ] `lib/workflows.ts::seedStepsForProject(projectId)` — idempotent;
      called from `updateProjectAction` when `service_type` changes.
- [ ] `<WorkflowSteps>` component on project page — list with status
      pills, "Mark done" button disabled until predecessors complete.
- [ ] Admin CRUD at `/dashboard/settings/workflows` to edit templates.

### 3. Permit tracking (builds on #2)
Sidewalk + other permit-required jobs get a first-class tracker with
status enum, permit number, expiration, inspection date, and a
reminder cron that fires at T-30 / T-7 before expiration.

- [ ] `migrations/018_permits.sql` — add `permit_status`, `permit_number`,
      `permit_applied_at`, `permit_approved_at`, `permit_expires_at`,
      `permit_inspection_at` columns on `projects`. New
      `permit_reminders` table (project_id, offset_days, channel, status,
      sent_at) unique on (project_id, offset_days).
- [ ] `<PermitTracker>` section on project page when
      `service_type='sidewalk_permit'` or `permit_status` is set.
- [ ] Cron `/api/cron/permit-reminders` daily, gated by flag
      `permit_reminders`.
- [ ] Permit PDF upload slot in the AttachmentsPanel surfaces on the
      tracker (filter by caption prefix `permit:`).

### 4. OpenPhone real sync ✅ Shipped 2026-04-15

- **`lib/openphone.ts::createOpenPhoneRestAdapter`** — real REST adapter
  (cron-friendly, no MCP connection at runtime). `getOpenPhoneAdapter()`
  returns it when `OPENPHONE_API_KEY` is set, else the stub.
- **`app/api/cron/openphone-backfill`** — every 15 min; pulls the last 30
  min of calls + messages, upserts `communications` by `external_id`.
- **`phoneMatchVariants()`** — E.164 + national 10-digit + last-10 fallback
  so Jobber's wildly-formatted phones still match OpenPhone payloads.
- **Unknown numbers** auto-create a stub client (`source='openphone'`) and
  a `leads` row.
- **Missed inbound calls** auto-create a `tasks` row so Ronnie sees them
  on the dashboard.
- Wired into `vercel.json` crons.

### 4b. OpenPhone real sync — original spec (historical)

- [x] `lib/openphone.ts::createOpenPhoneRestAdapter` — real fetch of
      calls + messages via the OpenPhone REST API (MCP is the wrong
      seam for a Vercel cron).
- [x] `app/api/cron/openphone-backfill/route.ts` — every 15 min; pulls
      last 30 min of activity, upserts `communications` by `external_id`.
- [x] Phone-matching helper `phoneMatchVariants()`: E.164 + national 10
      + last-10 fallback so formatting variance doesn't strand rows.
- [x] Unknown-number → `leads` row (source=`openphone`) + stub client.
- [x] Missed-call → `tasks` row for Ronnie.

### 5. AI task scrubber (builds on #4)
After every synced conversation, run the transcript/body through Claude
to extract: dates, times, addresses, project types, follow-up promises,
payment discussion. Auto-create `tasks` rows and `visits` placeholders
for anything that looks like a commitment.

- [ ] `lib/ai-scrubber.ts` — takes `{ body, direction, client_id,
      started_at }`, returns `{ tasks: [], placeholders: [] }`.
      Calls Claude via `@anthropic-ai/sdk` (model: `claude-opus-4-6`,
      low temperature, JSON mode with a tight schema).
- [ ] `app/api/cron/comm-scrubber/route.ts` — every 10 min, finds
      `communications` rows with `scrubbed_at IS NULL`, runs scrubber,
      inserts tasks/placeholder visits, stamps `scrubbed_at`.
- [ ] Migration `019_communications_scrub.sql` adds `scrubbed_at` +
      `extracted jsonb` columns.
- [ ] Feature flag `ai_comm_scrubber`; off by default until a dry-run
      dashboard at `/dashboard/settings/ai-scrubber` proves it out.

---

## 🔔 Wake-up note (2026-04-14)

Built overnight. Read this first.

**Migrations to run, in order, in the Supabase SQL editor:**

1. `migrations/009_payment_milestone_tokens.sql` — pay-link tokens
2. `migrations/010_receipt_settings.sql` — receipt auto-send settings
3. `migrations/011_line_item_library.sql` — saved line-item library
4. `migrations/012_notes.sql` — polymorphic notes system
5. `migrations/013_communications.sql` — OpenPhone history + tasks queue
6. `migrations/014_leads_and_service_types.sql` — lead-capture webhook
7. `migrations/015_jobber_import_columns.sql` — Jobber import columns
   (clients.lead_source, projects.external_id, quotes.title, etc.)

**Env vars to set in Vercel:**

- `APP_BASE_URL` — e.g. `https://app.sandiegoconcrete.ai`
- `CRON_SECRET` — shared secret for every `/api/cron/*` route
- `LEAD_WEBHOOK_SECRET` — public lead webhook shared secret
  (Duda / WordPress / Wix post with header `x-rose-secret`)
- Later, when adapters go real:
  - `GMAIL_*` (Gmail MCP OAuth)
  - `OPENPHONE_API_KEY`
  - `QBO_ACCESS_TOKEN`, `QBO_REALM_ID`
  - `DOCUSIGN_*` (template ID for 3-year warranty / 50% non-refundable
    deposit contract — needs your input, see below)
  - `GOOGLE_ADS_*` (conversion pixel + later agent)

**New since the last wake-up note (branding + Jobber import):**

- Tailwind palette rewritten to the Rose Concrete logo colors:
  navy `#1B2A4A` (brand-600), teal `#2ABFBF` (accent-400/500),
  cream `#F5EFE0` page background. Existing `brand-*` usages inherit the
  new hex automatically.
- `public/logo.png` replaced with the new logo image.
- Sidebar now renders the logo next to the app name.
- Jobber import rebuilt to the exact spec:
  `/dashboard/settings/import` — drag-and-drop per CSV, preview with
  5-row sample + per-row error list, then commit. Import order clients
  → jobs → quotes → visits → products, dedupe is skip-on-existing.
- Migration `015_jobber_import_columns.sql` adds `clients.lead_source`,
  `clients.tags`, `projects.external_id` (unique), `projects.scheduled_start`,
  `projects.completed_at`, `projects.service_address`, `quotes.title`,
  `quotes.approved_at`, `visits.scheduled_date`, `visits.scheduled_time`.

**New since the last wake-up note:**

- Lead-capture webhook live at `/api/public/lead` + embed script at
  `/embed/lead.js` + admin toggle at `/dashboard/settings/lead-webhook`
- Visit reminders cron (24h + 1h before) at `/api/cron/visit-reminders`
- Review-request cron + admin settings at `/dashboard/settings/reviews`
- Reports page at `/dashboard/reports` — revenue by service + by lead source
- Crew clock in/out with GPS on `/crew` (table `visit_time_entries`)
- Migration 014 bundles: `projects.service_type`, extended `leads`
  columns, `review_requests`, `visit_reminders`, `visit_time_entries`,
  4 new feature flags

**Input needed from you:**

- **DocuSign template ID** for the standard contract (3-year warranty,
  50% non-refundable deposit). Adapter is stubbed; drop the ID in
  `/dashboard/settings/docusign` once wired.
- **Google review URL** — the "leave us a review" link to land in the
  review-request email template (`/dashboard/settings/reviews`).
- **Brand colors from `public/logo.png`** — I couldn't sample the PNG
  from here. Drop hex values in `tailwind.config.ts` → `theme.extend.colors.brand`
  (currently a placeholder). Everything that uses `brand-600` will
  update automatically.
- **OpenPhone API key + phone number** — flips the stub adapter to real
  and enables the call/text history widget on every client page.

**Feature flags to flip** (Supabase `feature_flags` table, or settings pages):

- `payment_schedules` — ON
- `payment_reminders` — flip when ready
- `qbo_receipt_auto_send` — flip after migration 010
- `review_request_auto_send` — flip after migration 014 + reviews settings
- `visit_reminders` — flip when you want 24h + 1h SMS nags
- `lead_webhook` — flip to accept posts from the website

**What shipped overnight:**

- Jobber CSV import (`/dashboard/settings/import`) — clients, jobs, invoices, idempotent
- Line-item template library (`/dashboard/settings/line-items`) + one-tap insert on quote editor
- Polymorphic notes system (`components/notes-panel.tsx`) mounted on client/project/quote pages
- `<Clickable>` primitive — tappable phone / email / address everywhere
- OpenPhone history widget on client detail (stubbed until API key lands)
- `communications` + `tasks` tables (migration 013)
- `"use server"` bug fixed — `PROJECT_STATUSES` moved to `./constants.ts`
- …and everything below in the "Done" list.

---

## Done

- [x] **Dev-only localhost login bypass** — `app/login/actions.ts:45` (`devLogin`)
  server action + amber button in `app/login/login-form.tsx:67`. Guarded by
  `process.env.NODE_ENV !== "development"`; uses service-role key to mint a
  magic-link token for `ronnie@sandiegoconcrete.ai` (admin profile
  `66b4c54e-3608-4de4-a1d1-8c4ffe284c98`), then verifies on the cookie
  client to get a real session. No email, no contractor waiting.

## Queued

### 1. Payment schedules (Phase 2, QBO-adjacent)
Milestone-based payment plans on a project (deposit / mid-pour / completion,
or arbitrary custom schedule). App never touches money — it just tracks what's
due, when, and whether QBO says it's paid.

Build order:
- [x] `migrations/006_payment_schedules.sql` — `payment_schedules` +
      `payment_milestones` tables, feature flag `payment_schedules`.
- [x] Auto-seed a default schedule from quote (deposit % from quote row,
      balance due on completion) when project flips to `approved`.
      Helper: `lib/payment-schedules.ts::seedDefaultScheduleFromQuote`,
      called from `app/q/[token]/actions.ts` (public accept) and
      `app/dashboard/projects/actions.ts::updateProjectAction` (manual
      admin transition). Idempotent via UNIQUE(project_id).
- [x] Project page section (`MilestonesSection` in
      `app/dashboard/projects/[id]/milestones-section.tsx`): lists each
      milestone with status pill, method chosen, check vs card amount,
      "Copy pay link", "Preview" (opens `/pay/<token>`), and Mark paid /
      Undo paid. `markMilestonePaid` flips status + sets
      `receipt_pending=true` to tee up BACKLOG #3's receipt worker.
- [x] Nightly cron reconciles `payment_milestones.status` against QBO invoice
      payment state. `lib/qbo/reconcile.ts` is the pure function (adapter
      pattern — `createStubQboAdapter` until QBO API creds are wired),
      `app/api/cron/payment-reconcile/route.ts` is the Bearer-authed worker.
      Stamps `qbo_payment_id`, `qbo_paid_amount`, `qbo_paid_at`,
      `receipt_pending=true` when the adapter reports an invoice fully paid.
      Scheduled daily 6am Pacific in `vercel.json`.

**Also shipped this round:**
- `migrations/007_fix_profiles_rls_recursion.sql` — dropped the recursive
  "admin reads all profiles" policy on `public.profiles`, added
  `public.is_admin()` and `public.is_office_or_admin()` SECURITY DEFINER
  helpers. Unblocked dev login → /dashboard (was failing with
  SQLSTATE 42P17 on every profile read).

### 4. Credit-card surcharge (2.9% + $0.30, passed to client)
Standard processor rate Ronnie passes through. App never moves money, but
shows both options so the client knows exactly what they'll be charged.

- [x] `migrations/008_payment_methods.sql` — `invoice_settings` singleton
      (cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, check_instructions),
      `payment_method` enum, added `payment_method` / `fee_amount` /
      `total_with_fee` columns to `payment_milestones`.
- [x] `lib/payments.ts` — `computeCardFee/computeCardTotal` use the gross-up
      formula `(amount + flat) / (1 - percent)` so Ronnie nets the full
      milestone amount after the processor takes their cut. Single source
      of truth for fee math across the app.
- [x] `components/payment-milestone-card.tsx` — side-by-side pay-by-check
      vs pay-by-card display, auto-computed from the feeConfig.
- [x] `migrations/009_payment_milestone_tokens.sql` — opaque `pay_token`
      on each milestone (mirrors `quotes.public_token`), backfilled for
      existing rows.
- [x] Public pay page at `/pay/[token]` + `selectPaymentMethod` server
      action — client picks check or credit card, we write
      `payment_method` + `fee_amount` + `total_with_fee` to the milestone
      via service-role client.
- [x] `/dashboard/settings/invoicing` — admin form to edit
      `invoice_settings` (fee %, flat cents, absorb toggle, check
      instructions) with a live $1,000 preview showing what the client
      will see on the pay page.

### 5. Jobber-style UI (ongoing)
- [x] `components/dashboard-shell.tsx` — left sidebar (fixed on desktop,
      drawer on mobile), sticky top bar, role-aware nav (admin sees
      Settings).
- [x] `components/ui.tsx` — primitives: PageHeader, Card, StatusPill,
      JobCard, EmptyState, Primary/SecondaryButton.
- [x] Migrated existing pages to the new primitives:
      `/dashboard` overview, `/dashboard/clients`, `/dashboard/projects`,
      `/dashboard/quotes`, `/dashboard/schedule`, `/dashboard/settings`.
      All now use `PageHeader`, `Card`, `JobCard`, `StatusPill`,
      `EmptyState`.
- [x] `/dashboard/payments` list page — milestones across all schedules
      with open/paid/all filter pills.
- [x] Mobile polish pass — drawer a11y in `components/dashboard-shell.tsx`
      now has body scroll-lock, Esc to dismiss, Tab focus trap, focus
      return to menu button, `role="dialog" aria-modal="true"`, 44px
      touch targets, `aria-current="page"` on active nav link.

### 2. Automated payment reminders (depends on #1)
The computer nags, not Ronnie.
- [x] Feature flag `payment_reminders` (row in `feature_flags`).
- [x] `payment_reminders` table: one row per (milestone, channel,
      offset_days), unique index makes the seeder idempotent.
- [x] Reminder schedule config — `DEFAULT_REMINDER_RULES` in
      `lib/payment-reminders.ts`: T-3 email, T+0 email, T+3 email+sms,
      T+7 email+sms. `seedRemindersForSchedule` runs inside
      `lib/payment-schedules.ts` after milestone creation.
- [x] Vercel cron hits `/api/cron/payment-reminders` daily at 8:30am PT
      (30 15 * * * UTC). Adapter pattern — `createStubSenders()` returns
      skip until Gmail MCP / OpenPhone MCP are wired. Respects
      `reminders_paused`, skips missing email/phone, updates row status
      to sent/skipped/failed.
- [x] Admin override: `toggleMilestoneReminders` server action + Pause
      button on `MilestonesSection`.

### 3. QuickBooks receipt auto-send (Phase 2)
When QBO marks a milestone paid, auto-email the client a thank-you + receipt
PDF and log the send. No more "did you get my payment?" texts.
- [x] Feature flag `qbo_receipt_auto_send`.
- [x] Reconcile cron from #1.4 already sets `receipt_pending=true` when a
      milestone flips to paid (also set by the admin "Mark paid" button).
- [x] Worker at `app/api/cron/payment-receipts/route.ts` runs every 15
      min, pulls QBO receipt PDF via `fetchQboReceiptPdf` (stub → null
      for now), renders subject+body from template, sends via
      `ReceiptSender` adapter (`createStubReceiptSender` returns skip
      until Gmail is wired).
- [x] `payment_receipt_sends` table (unique on milestone_id +
      qbo_payment_id) — audit + dedupe so retries are idempotent.
- [x] `/dashboard/settings/receipts` — admin page with auto-send toggle,
      sender email, subject template, body template, and a live preview
      against sample data. Shows a migration-pending banner (disables
      the form) if migration 010 hasn't been run.
- [x] `lib/receipt-templates.ts` — `{{client_name}}`, `{{project_name}}`,
      `{{milestone_label}}`, `{{amount}}`, `{{paid_at}}` substitution.

## Wake-up checklist — things only you can do

Everything I could build is built and typechecks clean. Before flipping the
new workers on, run through these in order:

1. **Supabase migrations** — paste into the SQL editor, in order:
   - `migrations/009_payment_milestone_tokens.sql` (if not already run —
     needed for `/pay/[token]`)
   - `migrations/010_receipt_settings.sql` (required — the Receipts
     settings page shows a "run migration 010" banner until this lands)
2. **Env vars** (Vercel project settings):
   - `APP_BASE_URL` — used by the pay-link generator + reminder copy.
   - `CRON_SECRET` — already required for the existing crons; the three
     new ones (`/api/cron/payment-reconcile`, `/api/cron/payment-reminders`,
     `/api/cron/payment-receipts`) use the same secret.
   - Later, when wiring the adapters: `QBO_ACCESS_TOKEN`, `QBO_REALM_ID`,
     Gmail OAuth creds, OpenPhone API key.
3. **Flip feature flags** (in Supabase `feature_flags` table, or the
   new Receipts settings page for the receipt flag):
   - `payment_schedules` — already on.
   - `payment_reminders` — turn on when you want the daily nag to start.
     Stub sender means it's safe to flip; it'll log "skipped, not wired"
     until Gmail/OpenPhone are attached.
   - `qbo_receipt_auto_send` — same deal. Flip via
     `/dashboard/settings/receipts` once migration 010 is run.
4. **Wire real adapters** (replace stubs):
   - `lib/qbo/reconcile.ts::createQboApiAdapter` — TODO body, swap out
     `createStubQboAdapter()` call in the reconcile cron.
   - `lib/reminder-senders.ts::createStubSenders` — replace in
     `/api/cron/payment-reminders/route.ts` with Gmail + OpenPhone
     implementations.
   - `lib/receipt-sender.ts::createStubReceiptSender` +
     `fetchQboReceiptPdf` — replace in
     `/api/cron/payment-receipts/route.ts`.

Once any adapter is wired, the corresponding cron starts doing real work
on the next tick — no redeploy needed beyond the env var change.

## Competitor-parity backlog

Pulled from a cross-read of Jobber, ServiceTitan, Housecall Pro, FieldPulse,
and Workiz. Ordered by **value per unit of build effort** for Rose
Concrete specifically — not general service-business parity. Ronnie's
workflow shapes what wins:

1. Ronnie builds quotes in the truck → fast quote entry matters more than
   dispatch optimization.
2. One crew, small team → multi-tech routing is premature, but crew
   clock-in with GPS is real.
3. Marketing spend is concentrated → lead-source ROI reporting is
   disproportionately valuable.

### P0 — ship next (high value, tractable)

- [x] **Saved line-item library** — one-tap insert of "4" driveway pour
      per sqft", "stamped concrete upcharge", etc. into a quote. Every
      competitor has this; it's the single biggest "Ronnie is faster"
      win. New table `line_item_templates` (title, description, unit,
      unit_price, default_quantity, is_active, sort_order). Admin CRUD
      page at `/dashboard/settings/line-items`. "Insert from library"
      button on the quote editor opens a picker.
- [ ] **Lead-source ROI + revenue-by-service-type report** — we already
      capture `clients.source` and `quotes.accepted_total`; just need a
      read-only dashboard. Add `projects.service_type` enum (driveway,
      patio, stamped, sidewalk, repair, other) and a
      `/dashboard/reports` page with two tables: revenue per source
      (last 30/90/365 days, plus CPL calc if we have spend from
      marketing_metrics) and revenue per service type.
- [ ] **Automated Google review request** — 3 days after a milestone
      flips to paid-and-receipted, send a one-line "how'd we do? here's
      the link" email/SMS. Reuses `payment_receipt_sends` as the
      paid-at anchor. New table `review_requests` (milestone_id unique,
      channel, status, sent_at). New cron
      `/api/cron/review-requests` daily. Template configurable in a
      new `/dashboard/settings/reviews` page; settings includes the
      Google review URL. Feature flag `review_request_auto_send`.
- [ ] **On-my-way SMS** — button on a visit row that fires a pre-baked
      "Ronnie is heading your way, ETA 20 min" text to the client via
      OpenPhone. Reuses the existing SMS adapter stub. Writes an
      `activity_log` row with `action='on_my_way_sent'`.
- [ ] **Appointment reminder texts** — 24h and 1h before a scheduled
      visit, SMS the client. New cron
      `/api/cron/visit-reminders` every 15 min, new
      `visit_reminders` table unique on (visit_id, offset_hours).
      Feature flag `visit_reminders`.

### P1 — after P0 (still high value, more scope)

- [ ] **Quote → work order → invoice one-click** — a button on a quote
      that (a) flips project to `approved`, (b) seeds the payment
      schedule, (c) creates the QBO invoice via MCP, (d) revalidates
      everything. Most plumbing exists; it's mainly wiring.
- [ ] **Recurring jobs (maintenance contracts)** — new
      `recurring_job_templates` table (client_id, service_type, cadence
      weeks/months, next_due_on, price, active). Daily cron
      spawns a new `projects` row when `next_due_on <= today` and bumps
      `next_due_on` forward. Admin page at
      `/dashboard/recurring`.
- [ ] **Customer self-service portal** — extend `/q/[token]` and
      `/pay/[token]`: add a client-facing index page at
      `/c/[client_token]` with all their quotes, paid/unpaid milestones,
      and completed-job photos. New `clients.portal_token` column;
      service-role data fetch like the existing public pages.
- [ ] **Crew clock-in/out with GPS** — new `visit_time_entries` table
      (visit_id, user_id, clock_in_at, clock_in_lat/lng, clock_out_at,
      clock_out_lat/lng). Crew page has a big Clock In / Clock Out
      button; browser geolocation attached. Timesheet report at
      `/dashboard/reports/timesheets`.
- [ ] **Batch invoicing** — on the Payments page, multi-select open
      milestones and "Send invoice emails to all selected" via Gmail
      adapter.
- [ ] **Automated overdue-invoice follow-ups** — the payment-reminders
      cron already handles T+3 / T+7; add T+14, T+30, and T+60
      escalations with successively firmer copy.
- [ ] **Job completion report** — at the moment a project flips to
      `done`, send the client a branded PDF with project photos + final
      totals. Uses existing photos table; needs a simple PDF renderer
      (React-PDF or puppeteer).

### P0 — OpenPhone deep integration (new spec, added 2026-04-14)

OpenPhone (Quo) is Ronnie's primary phone — every client touchpoint runs
through it. Making that history first-class in the app turns the platform
into a real CRM instead of a job tracker.

- [x] **Client call + text history on every client page** — pull from
      OpenPhone MCP by client phone number. New widget
      `<OpenPhoneThread clientId>` on `/dashboard/clients/[id]`. Server
      component; cache per-request.
- [ ] **Unknown-number auto-lead creation** — webhook/cron consumes
      OpenPhone recent calls; any inbound call from a number not in
      `clients.phone` creates a `leads` row with source=`openphone` and a
      stub client row. Dedupe on `raw_payload->>phone`.
- [ ] **Call recordings + transcripts attached to client** — new
      `communications` table (client_id, direction, channel,
      started_at, duration_s, recording_url, transcript, external_id
      unique). OpenPhone MCP fetch populates on demand + nightly backfill.
- [ ] **AI call summary → note** — after a call ends, trigger a
      summarize-and-append pass that writes to `notes` (see below) with
      type=`call_note`. Uses the platform model (stub adapter pattern).
- [ ] **One-tap call from client page** — `tel:` link on phone number
      + "Call via OpenPhone" button that fires the OpenPhone MCP
      "start_call" (or falls back to `tel:`).
- [ ] **Missed-call tasks** — new `tasks` table, auto-seeded on any
      missed inbound call, shown on `/dashboard` as a to-do queue.

### P0 — Notes system, everywhere (new spec, added 2026-04-14)

Polymorphic notes so every entity (client, project, quote, visit) can
accrue context instead of losing it in Ronnie's head.

- [x] **`notes` table** — id, entity_type (enum), entity_id (uuid),
      body (text), kind (enum: call_note, site_visit, internal,
      customer_update), is_pinned, created_by, created_at. Indexed on
      (entity_type, entity_id, created_at desc).
- [x] **`<NotesPanel>` component** — reusable widget: list view with
      pinned-at-top, inline add form, pin/unpin + delete controls.
      Mount on client, project, quote detail pages.
- [ ] **OpenPhone auto-notes** — call summary worker writes `notes` rows
      with kind=`call_note` + a back-reference to
      `communications.external_id`.
- [ ] **Author stamp** — created_by joins to `profiles.full_name`;
      show avatar initials + time ago.

### P0 — Production polish (every button wired, every list searchable)

Not a single feature — a systematic audit of the app. These are the
conventions we enforce everywhere; add to CLAUDE-style guidance when the
audit lands.

- [ ] **Every form saves** — zod schema + server action + `useActionState`
      + visible ok/error feedback. Audit every existing form.
- [ ] **Every status button mutates** — no dead `<button>`s. Audit
      especially: visit status, project status, quote status, milestone
      status.
- [ ] **Every delete confirms** — `confirm()` or modal; no silent
      cascading deletes. Audit every destructive action.
- [ ] **Every list searchable + filterable** — text search + relevant
      status filter on: clients, projects, quotes, visits, payments,
      leads.
- [x] **Tappable phone numbers** — `<a href="tel:+…">` with a consistent
      icon; intercepted on mobile.
- [x] **Tappable addresses** — `<a href="https://www.google.com/maps/?q=…">`
      with a pin icon on client + project + visit detail pages.
- [x] **Tappable emails** — `<a href="mailto:…">` across client pages.
- [x] **`<Clickable>` primitive** — centralize the tel/mailto/maps
      helpers in `components/clickable.tsx` so everywhere uses the same
      styling + analytics hooks.

### P2 — defer (needs new infrastructure or out of scope for a solo shop)

- [ ] **AI technician assignment** — Rose has one crew; rebuild when
      they add a second.
- [ ] **Route optimization** — Google Maps Routes API, only worth it at
      4+ jobs/day.
- [ ] **Real-time GPS tracking on a map** — either native mobile app or
      aggressive PWA + background geolocation. Large undertaking.
- [ ] **Drag-and-drop dispatch board** — same infra need as above.
- [ ] **Two-way SMS in-app** — receive OpenPhone webhooks, persist a
      messages table, UI thread view.
- [ ] **ACH / bank-transfer payments** — Plaid or Stripe ACH integration,
      requires new payment adapter.
- [ ] **Timesheet reports per crew member per week** — comes after
      clock-in/out lands.
- [ ] **Job-progress photos required before mark-complete** — simple
      guard; waits for photo-upload UX polish.
- [ ] **Monthly/quarterly business summary email** — easy after the
      reports page exists.
- [ ] **Customer lifetime value tracking** — derivable from current
      schema, just needs a query + card on the client detail page.
- [ ] **Multi-tenant / white-label SaaS** — company signup flow, full
      RLS rewrite (every table needs `company_id`), billing. Treat as
      a separate product, not a feature. Park until Rose Concrete
      itself is working end-to-end.

### P0 — Full product spec (added 2026-04-14 night build)

The big spec. Organized by surface area. Each item is a concrete
deliverable; everything else in P0/P1/P2 above is a subset.

**Branding**

- [ ] Sample brand colors from `public/logo.png` and wire into
      `tailwind.config.ts → theme.extend.colors.brand`. Audit every
      `brand-600` usage once real hex values land.

**Estimates & Quotes (Ronnie's most-used surface)**

- [x] Line-item library (shipped — `/dashboard/settings/line-items`)
- [ ] Service-type quote templates — pre-built templates for driveway,
      stamped, patio, sidewalk, RV pad, pickleball court. New table
      `quote_templates (service_type, default_line_items jsonb)`; "Start
      from template" picker on new-quote dialog.
- [ ] Photo attachments on line items — already have `photos`; wire them
      to render on the public `/q/[token]` page per-line and grouped.
- [ ] Upsell / optional line items — flag `is_optional` on
      `quote_line_items`, toggleable by client on the public page (field
      already exists; needs UX + accepted-total recompute).
- [ ] One-click quote → invoice — button on accepted quote that creates
      QBO invoice via adapter, seeds payment schedule, flips project
      status. Wiring, not new infra.
- [ ] Branded PDF quote — React-PDF renderer at
      `/q/[token]/pdf`; Ronnie can download or email.

**DocuSign (auto-contract on accept)**

- [ ] Adapter `lib/docusign.ts` with `createStubDocusignAdapter()` and
      a real impl that calls the DocuSign MCP. Account ID hardcoded:
      `e9b3a88c-4fc1-4c86-a098-24e31ee82b13`.
- [ ] Auto-trigger on public quote accept — `/q/[token]/actions.ts`
      → after flipping `accepted_at`, call `docusignAdapter.sendContract`
      with template fields (client name/email, project address, accepted
      total, 50% non-refundable deposit amount, 3-year warranty text).
- [ ] `/dashboard/settings/docusign` — admin form for template ID + a
      "send test envelope" button.
- [ ] Webhook `/api/webhooks/docusign` — updates
      `quotes.docusign_status` when envelope state changes.

**Customer reminders & follow-ups**

- [ ] Appointment reminders — 24h + 1h before a scheduled visit, email
      + SMS. Cron `/api/cron/visit-reminders`, table
      `visit_reminders (visit_id, offset_hours, channel, status)`.
- [ ] Payment reminder (already shipped) — running on
      `/api/cron/payment-reminders`.
- [ ] Overdue invoice follow-ups — T+14 / T+30 / T+60 escalation copy
      layered into payment reminders.
- [ ] Review request — 3 days after final payment, SMS + email ask for
      Google review. Table `review_requests`, cron
      `/api/cron/review-requests`, settings
      `/dashboard/settings/reviews`.

**QuickBooks (two-way sync)**

- [ ] Inbound: reconcile cron (already shipped) marks milestones paid.
- [ ] Outbound: create invoice in QBO when quote accepted.
- [ ] Outbound: create customer in QBO when new client added.
- [ ] Settings page `/dashboard/settings/qbo` — OAuth connect button,
      realm id, last-sync timestamp, per-entity sync toggles.

**OpenPhone (Quo) deep integration**

- [x] Call + text history widget (shipped, stub adapter)
- [ ] Real OpenPhone MCP adapter (`lib/openphone.ts::createOpenPhoneMcpAdapter`)
- [ ] Backfill worker — cron `/api/cron/openphone-backfill` every 15
      min, pulls recent calls/messages, upserts into `communications`
      by `external_id`.
- [ ] Unknown-number → auto-lead — any inbound call from a number not
      in `clients.phone` creates a `leads` row + stub client.
- [ ] AI call summary → note — after a call with transcript, write a
      `notes` row with kind=`call_note`.
- [ ] Missed-call auto-task — backfill worker seeds a `tasks` row on
      any `was_missed=true` call.
- [ ] One-tap call button on client page — fires
      `openphoneAdapter.startCall(phone)`, falls back to `tel:`.

**Notes system**

- [x] Polymorphic `notes` table + `<NotesPanel>` (shipped on client +
      project + quote pages)
- [ ] Mount on visit detail page.
- [ ] Kinds: call_note, site_visit, internal, customer_update — filter
      pills in the panel.

**Crew mobile**

- [ ] Clock in/out with GPS — page `/crew/today`. New table
      `visit_time_entries (visit_id, user_id, clock_in_at,
      clock_in_lat/lng, clock_out_at, clock_out_lat/lng)`.
- [ ] Tappable addresses + phones on crew pages (reuse `<Clickable>`).
- [ ] On-my-way SMS — button on visit row that fires a pre-baked text
      via OpenPhone adapter; writes `activity_log`.
- [ ] Required completion photo — cannot flip visit to `done` without
      at least one photo attached.

**Scheduling & dispatch**

- [ ] Recurring jobs — `recurring_job_templates`, daily cron spawns
      new `projects` rows at next_due_on.
- [ ] Drag-and-drop dispatch board (P2 — deferred until crew > 1).
- [ ] Route optimization via Google Maps Routes API (P2).
- [ ] Real-time GPS crew map (P2 — needs background geolocation).

**Invoicing**

- [ ] One-click quote → invoice (see Estimates section).
- [ ] Batch invoicing — multi-select on `/dashboard/payments`.
- [ ] Payment methods — check + credit card (shipped); ACH deferred.

**Reporting**

- [ ] `/dashboard/reports` — revenue by service type, revenue by lead
      source, job profitability (materials cost field needed on
      projects), client LTV.
- [ ] Monthly summary email — cron fires first of month to admins.

**Multi-tenant** (P2 — park until Rose is end-to-end)

- [ ] `company_id` on every table; RLS rewrite.
- [ ] Company signup flow at `/signup`.
- [ ] White-label branding per company.
- [ ] Subscription billing.

**Customer portal**

- [ ] `/c/[client_token]` — index of quotes, paid/unpaid milestones,
      project photos. Reuses public-token pattern.
- [ ] Client can request a revisit / new quote from portal.

**Google reviews** (see Customer reminders)

**Duda website content sync (added 2026-04-14 request)**

- [ ] **Portfolio auto-publish** — when a project flips to `done` and has
      ≥1 photo, post a new portfolio entry to the Duda site via Duda API.
      New adapter `lib/duda.ts` (`createStubDudaAdapter()` until creds
      land). New table `duda_publishes (project_id unique, external_id,
      published_at, status)` so re-running is a no-op. Cron
      `/api/cron/duda-portfolio-sync` every 30 min; gated by flag
      `duda_portfolio_sync`.
- [ ] **Automated Google Business Profile review flow** — same trigger
      as the email review request, but also posts an update to the GBP
      listing ("we just finished a stamped driveway in La Jolla"). Uses
      the GBP API via a `lib/gbp.ts` adapter. Links back to the
      portfolio entry when it exists.
- [ ] **SEO content updater** — weekly cron `/api/cron/seo-refresh`
      scans completed projects per service type, regenerates Duda
      service pages (driveway / stamped / patio / sidewalk / RV pad /
      pickleball) with freshly rotated hero photos + updated
      "recent work in…" copy. Gated by flag `seo_content_refresh`.
      Uses the platform model adapter for copy suggestions; human
      approval queue at `/dashboard/settings/seo-refresh` before
      publish (shadow mode by default).

**Website / lead integration**

- [ ] Public webhook `/api/public/lead` — accepts POST from Duda /
      WordPress / Wix contact forms. Header `x-rose-secret` =
      `LEAD_WEBHOOK_SECRET`. Body: `{ name, phone, email, address,
      service_type, message, source }`. Creates/updates client, creates
      `leads` row, fires instant-response SMS + email, drafts a quote,
      seeds a `tasks` row for Ronnie to follow up.
- [ ] Embeddable contact form — static HTML/JS snippet served from
      `/embed/lead.js` that posts to the webhook. Ronnie can drop it
      into any website without a framework.
- [ ] Google Ads conversion pixel fires on successful `/q/[token]`
      accept. Settings page for pixel ID.
- [ ] Autonomous Google Ads agent (shadow mode initially) — cron
      `/api/cron/ads-agent` every 6h. Reads campaign performance via
      Google Ads API, proposes bid/budget/keyword changes, writes to
      `ads_agent_proposals` table. Ronnie approves or dismisses each.
      Approved keywords (San Diego County only): driveways, stamped
      concrete driveways, pickleball courts, patios, RV pads, sidewalks.

## Later (captured so we don't lose them)

See plan `Phase 3` section for long-tail automations — warranty service
reminders, supplier price sheet updates, etc.
