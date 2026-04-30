# Rose Concrete Crew Mobile App — Full Audit

**URL audited:** https://rose-concrete-app.vercel.app/crew
**Date:** Sunday, April 26, 2026
**Logged in as:** Ronnie (admin)
**Viewport:** Mobile-responsive (centered narrow column on desktop)

---

## CRITICAL / SHOWSTOPPER BUGS (fix first)

### 1. Tapping a quote template silently creates phantom invoiceable jobs
- On `/crew/create/quote`, tapping any template (e.g. "Basic Sidewalk Repair for Small Job") returns the user to Home and shows a red toast: *"…template loaded. Use the desktop app to send the quote — full mobile builder is coming soon."*
- The Home counter **"X require invoicing jobs"** went **14 → 17 → 21** as I tapped templates and reloaded Home. New phantom Draft quotes (e.g. `Quote #2026-0427-298 — Stamped driveway — KEN — Total $0.00`) appeared in the quote list with **no line items**, **$0.00 total**, and **client KEN attached** even though I never picked KEN.
- This is data corruption. Any crew member tapping a template is dirtying the Quote table and inflating the "to-invoice" counter on the dashboard.

### 2. Search is broken in the default state
- Typing "Linda" in the unfiltered Search returns the same "Recently active" list (Hangar Showcase, Pickleball Court Showcase, Patio, Jacob Scheff, etc.) — none of which contain "Linda".
- Search only actually filters when one of the type pills (Clients / Requests / Quotes / Jobs) is selected.
- A field worker looking up a customer by name will get garbage results unless they know to tap a filter pill first.

### 3. Notification bell goes to the wrong page
- The bell in the header (showing badge "4", later "5") is wired to `href="/crew/more"` instead of a notifications screen.
- There is no notifications page anywhere in the crew app, but a badge keeps incrementing — so the user is told they have unread alerts they can never read.

### 4. "Clock In" button does not clock in
- The big green Clock In CTA on Home is just a `<Link>` to `/crew/schedule`. It opens the Schedule view; it does not start a time entry, does not write to the Timesheet, and the Timesheet still shows "0m" / "No hours" for today after pressing it.
- Total Completed Time on Home stays at `00:00` no matter what.

### 5. Almost every tap on Home / More kicks the crew member out of the crew app
- Every "To do" row on Home links to `/dashboard/...` (the desktop admin app), not to a crew screen:
  - 0 new requests → `/dashboard/requests?status=new`
  - 0 assessments completed requests → `/dashboard/requests?status=qualified`
  - 0 approved quotes → `/dashboard/quotes?status=accepted`
  - 0 action required jobs → `/dashboard/projects?status=scheduled`
  - 14 require invoicing jobs → `/dashboard/projects?status=done`
  - "View all" under Business health → `/dashboard/reports`
- Every row on the More menu goes to `/dashboard/settings/...` — Apps & integrations, Marketing, Subscription, Product updates, About, Profile, Manage team, Company details.
- Once kicked into `/dashboard`, there is no "back to crew app" link. The user has to know to type the URL.

### 6. Hydration / null-parentNode errors on every page load
Console logs (production minified):
- `Error: Minified React error #418` (hydration mismatch — server HTML ≠ client HTML) — fires on every page navigation.
- `TypeError: Cannot read properties of null (reading 'parentNode') at $RS` — fires repeatedly.
- The renderer froze twice during the audit (CDP screenshot timeouts of 30s+) when clicking through the search results to a job detail. Browser had to be navigated away to recover.

### 7. Off-by-one date everywhere
- Today is **Sun Apr 26, 2026**.
- New Expense form's DATE picker pre-fills **04/27/2026** (tomorrow).
- New quotes created today are stamped `Quote #2026-0427-xxx` and the detail page shows *"Issued Apr 27, 2026"*.
- Looks like a UTC-vs-local timezone bug — server is generating dates in a TZ that's already on the next day.

### 8. Two different "this week" definitions
- Home → "This week — Apr 25 – May 1"
- Timesheet → "This week — Apr 26 – May 2"
- Different week-start days are used in different places. Hours / metrics in one screen will not line up with the other.

---

## HOME SCREEN (`/crew`)

### What works
- Greeting "Good morning, Ronnie" and date render correctly.
- Bottom nav (Home, Schedule, Timesheet, Search, More) navigates to the right URLs.
- Layout doesn't visibly break.

### What's broken / wrong
- **Notifications bell** routes to `/crew/more` (see Critical #3). Badge of "4" shifted to "5" mid-session with no notifications screen to read.
- **Assistant button** (sparkle icon, top right) — tapped it; nothing happens. No panel, no modal, no toast, no console error. Dead button.
- **Clock In button** — does not clock in (see Critical #4).
- **"No visits scheduled today"** — fine as a state, but there's no way to tap through to add or look at upcoming visits from this card.
- **"This week" / "Total completed time 00:00"** — week range conflicts with Timesheet (see Critical #8). View Timesheet link works.
- **All five "To do" rows** — leave the crew app for `/dashboard/...` (see Critical #5). The "14 require invoicing jobs / Worth $46,010.86" count is not stable (jumped to 21 during this session — see Critical #1).
- **Business health section** ("Job value $0.00", "Visits scheduled 0", "View all") — these are admin/owner KPIs that don't belong on a field crew home screen. "View all" also leaves to `/dashboard/reports`.

### What's missing
- "My next visit" / "Get directions" — the most useful card for a crew member is absent.
- Today's assigned jobs / today's clients.
- A way to see/respond to the unread notifications the bell badge is advertising.
- Anything actually crew-relevant: punch list, photos owed, signatures owed, materials list.

---

## + (Floating Action Button) — Create Forms

The FAB opens a speed-dial with: **Request, Task, Expense, Invoice, Quote, Job, Client.** No "Visit", no "Note", no "Photo", no "Time entry".

### `/crew/create/client` — New Client
- Fields: First name, Last name, Add Company Name (label + input — redundant), Add Phone Number, Add Email, Add Lead Source, Property address.
- "Add from Contacts" button is permanently disabled with text *"The Contact Picker isn't available on this browser. It works on Android Chrome — on iPhone, copy the contact in manually."* — useless on iOS Safari (which is what most field crews use).
- **Validation error is shoved into the URL query string** (`?error=Please add a phone number or email so we can reach the client.`) instead of rendered in the UI. The user gets no visible feedback after tapping Save.
- No required-field indicators (no red asterisks).
- No client type (residential / commercial), no preferred contact method, no notes, no tags, no second contact.
- Address has no autocomplete / no map verification.
- Top-right "+" icon does nothing.
- **Linda Rose appears as a duplicate 3 times** (same phone 5076181846, same email `sample@nothing`, same address). The form is happy to create dupes and there's no merge tool.

### `/crew/create/request` — New Request
- Fields that work: Client picker, Request title, "How can we help?" textarea.
- **Three out of four sections are "COMING SOON":** Upload images, Line items, Schedule.
- Copy says *"For now, ask the client to send photos via OpenPhone"* and *"Office staff will call to schedule once the request lands"* — i.e. crew can't do this in the app.

### `/crew/create/task` — New Task
- Fields: Title, Description, Client, Due Date (mm/dd/yyyy), Team (assign).
- Saving with empty title outlines the field green but **shows no error message**.
- Missing: priority, time of day, reminder, recurring tasks, subtasks/checklist, attachments, tags.

### `/crew/create/expense` — New Expense
- Fields: Title, Description, **DATE pre-filled to TOMORROW (04/27/2026)** — see Critical #7. TOTAL ($0.00), Linked Job picker.
- "Reimburse to" is **COMING SOON** — copy: *"Per-employee reimbursement routing comes online once payroll is wired up. For now every expense saves as company-paid."* So crew expenses can't be marked reimbursable.
- "Attach receipt" is **COMING SOON** — copy: *"Photo uploads are coming soon. Send the receipt to the office via email or text in the meantime."* This is the single most important feature in a field expense app and it isn't built.
- Missing: category (materials/fuel/equipment/meals), vendor/payee, payment method (cash/card/check), tax line.

### `/crew/create/invoice` — New Invoice
- **Functionally unusable.** The only working field is the client picker.
- A grey block reads *"Invoice details — COMING SOON. Title, terms, salesperson, line items, and payment settings come from the desktop app for now. Pick the client and the office will finish from their workstation."*
- Two CTAs at the bottom — "Review and Send" (primary green) and "Save" (text link). Both ship a ~empty invoice payload with no body.

### `/crew/create/quote` — New Quote
- Lists 6 templates: Basic Sidewalk Repair for Small Job, Driveway Template, Patio Template Minimum, **Rose Concrete** (generic/placeholder template name shouldn't be in the list), Sidewalk Template For Larger than 20 Linear feet, Walkway Replacement Template.
- Tapping a template = **the catastrophic phantom-quote bug** in Critical #1: kicks user back to Home, shows a red toast, and silently inserts a $0.00 Draft quote with the next sequential `2026-0427-NNN` number attached to whatever client the system assigns (KEN appeared on a quote I didn't pick KEN for).
- "Create New Quote" button at bottom doesn't open a builder — no live builder exists; copy elsewhere admits *"full mobile builder is coming soon."*
- No template preview before tapping. No way to delete/rename a template from here.

### `/crew/create/job` — New Job
- Fields: Client, Job Title (e.g. Driveway pour), Instructions, Team.
- **"Line items + scheduling — COMING SOON."** Copy: *"Line items, full schedule pickers, and the invoicing reminder come online once the desktop quote-to-job flow ships on mobile."*
- Missing: service address (separate from client address), date/time, estimated duration, materials list, site notes, photos.

### Client picker (used by Request/Task/Expense/Invoice/Job)
- Search bar + recent clients list + "Add new client" button — works.
- **Leaks test/garbage data into production:** `(Unnamed client)`, `Report totals:`, `Test Lead`, three duplicate `Linda Rose` rows, "Showcase" appearing as a person.
- The presence of "(Unnamed client)" proves the New Client form really does save records with no name (validation only requires phone OR email).

---

## SCHEDULE (`/crew/schedule`)

Header has 4 icons (calendar, filter/sort, bell, sparkle). Body has Day / List / Map tabs and a one-week strip.

### What works
- Day / List / Map tabs each switch the view.
- Date-strip taps select that date (the green pill moves correctly).
- The bottom nav and FAB stay visible on every view.

### What's broken / wrong
- **The "April" month dropdown is dead.** Tapped → no menu.
- **Calendar icon in the header is dead.** Tapped → nothing.
- **Filter/sort icon (next to bell) is dead.** Tapped → nothing.
- **List view** is just an "Nothing scheduled" empty card (week is genuinely empty) — fine, but there is no "schedule a visit" CTA anywhere on the screen.
- **Day view** shows hours from 6A onward in a vertical timeline with **no current-time indicator**, no all-day section, no way to tap an empty slot to create a visit.
- **Map view** is roughly **440 × 180 px** — way too small for a field worker. It shows a faint static neighborhood map (Grant Hill / Mt Hope / Logan Heights / Mountain View / Barrio Logan / Southcrest) with **one** unlabeled blue dot. No pins for the day's actual visits. Changing the selected date does not change the map content.
- **"View all" on the map opens https://www.google.com/maps in a new tab** — kicks the user out of the app entirely. There is no in-app expanded map view.
- Date strip only shows ±0 to +6 days from today; no way to swipe/scroll to next week.

---

## TIMESHEET (`/crew/timesheet`)

### What works
- Page renders. Shows "THIS WEEK — 0m, Apr 26 – May 2" header.
- Prev / Next week arrows are clickable.
- Each weekday row renders.

### What's broken / wrong
- Week range disagrees with Home (Apr 25 – May 1 there). See Critical #8.
- The "—" icon at the right of each day row looks tappable but doesn't expand or open anything.
- **No way to clock in, clock out, or manually add a time entry** from the Timesheet — the only "Clock In" CTA in the entire app is on Home, and it doesn't actually clock in (Critical #4).
- No total-by-day, no break tracking, no job-attached time, no edit / approval workflow.
- No PDF / CSV / share button to send a week to the office.

---

## SEARCH (`/crew/search`)

### What works
- The four pill filters (Clients, Requests, Quotes, Jobs) all toggle.
- With a pill selected, typing does filter the list (e.g. Clients + "Linda" → 3 Linda Rose dupes).

### What's broken / wrong
- **Default search ignores the query** (Critical #2). With no pill selected, "Linda" → shows the same Recently active feed.
- Tapping the **Requests** pill with no query shows "Start typing to search." while Clients/Quotes/Jobs show their recent lists — inconsistent empty state.
- Recent feed is full of demo / test rows: Hangar Showcase, Pickleball Court Showcase, Sidewalk Showcase, Patio Showcase, Walkway Showcase, Driveway Showcase, "Report totals:", "(Unnamed client)", "Test Lead", "Showcase" (as a person).
- Every recent job carries a black "**Conv**" tag — unlabeled abbreviation; unclear what it means to the crew (Conversion? Conversation?).
- **No filter for Invoices, Expenses, Payments, or Visits.**
- No advanced search (no date range, no status, no city, no value range).
- No recent searches / saved searches.

---

## MORE (`/crew/more`)

Items: **Apps & integrations | Marketing** (2-up tile), then **Support, Subscription, Product updates, Refer a friend, About, Profile, Manage team, Company details, Sign out** (button).

### What's broken / wrong
- **Notifications bell is missing on this page** (every other page has it in the header). Inconsistent header.
- **Every link except Sign Out kicks the user to `/dashboard/...`:**
  - Apps & integrations → `/dashboard/settings/integrations`
  - Marketing → `/dashboard/settings/reviews` (label says Marketing but URL is "reviews"?)
  - Subscription → `/dashboard/settings/workspace`
  - Product updates → `/dashboard/activity`
  - About → `/dashboard/settings` (About should show app version, build, EULA — not settings)
  - **Profile and Manage team go to the SAME URL** (`/dashboard/settings/team`) — Profile is mislabeled or routed wrong.
  - Company details → `/dashboard/settings/business-profile`
- **Support is a `mailto:` link** to `support@sandiegoconcrete.ai` — opens the device's email client. There is no in-app help, no FAQ, no chat, no version info, no "Contact us" form.
- **Refer a friend is also `mailto:`** → `refer@sandiegoconcrete.ai` — there is no actual referral system; it just opens an email.
- The whole "More" menu is owner-/admin-oriented (Subscription, Refer a friend, Manage team, Company details) — none of this is appropriate for a non-admin crew member to see.
- No screen for crew preferences: notification settings, units (in/cm), default view, dark mode, language.

---

## DETAIL PAGES

### Client detail (`/crew/clients/<id>`)
Tested with Linda Rose.
- Shows: avatar, name, "Active" badge, three tile buttons (Call / Email / Address), PHONE / EMAIL / ADDRESS / LEAD SOURCE rows, JOBS (0), QUOTES (0), Done button.
- **Phone is unformatted:** `5076181846` instead of `(507) 618-1846`.
- **Email is invalid** (`sample@nothing` — no TLD). The form happily saved a non-RFC-compliant email.
- **No Edit button** — bad data cannot be fixed from the crew app.
- **No Merge button** — can't deduplicate the three Linda Rose copies.
- **No Delete button.**
- LEAD SOURCE shows just "—" (empty stub).
- **Missing sections:** Invoices, Payments, Notes / activity log, Property photos, Preferred contact method, Second contact, Tags.
- Don't know if Call / Email / Address tile buttons actually trigger `tel:` / `mailto:` / map intents — none was confirmed working in this audit.
- The "Done" button at the bottom is misleading — it just closes the page; nothing was being edited.

### Job detail (`/crew/projects/<id>`)
Tested with "Patio Project — nikki butera".
- Shows: "Lead" badge, title, client name (link), "VISITS (0) — No visits scheduled yet.", Done button.
- **That's it.** Everything else is missing:
  - Job address, map, get-directions button
  - Description / scope of work / instructions
  - Line items / total / quote linkage
  - Materials list, equipment list
  - Photos (before / during / after)
  - Notes / activity log
  - Time tracking against this job
  - Forms / checklists / signatures
  - Status change buttons (Start, Pause, Complete, On Hold)
  - Team assigned to this job
  - Customer phone / call button
  - Invoice / payment status
- URL says `/projects/` but page title says "Job" — naming inconsistency between **Project** and **Job** throughout.

### Quote detail (`/crew/quotes/<id>`)
Tested with `Quote #2026-0427-298 — Stamped driveway — KEN`.
- Shows: number, "Draft" badge, title, client (link), "Issued Apr 27, 2026 · Valid through May 27", LINE ITEMS ("No line items on this quote."), Total $0.00, Done button.
- Issued date is **tomorrow** (Critical #7).
- **Two parallel quote-numbering schemes** exist in the system: `Quote #2026-0427-298` (date-based) and `Quote #192` / `#191` / `#190` (sequential) — confusing and likely two different code paths writing different quote IDs.
- **No actions:** no Edit, no Add Line Item, no Send to Client, no Convert to Job, no Approve / Reject, no Duplicate, no Delete, no PDF preview, no payment terms.
- All visible quotes are status "Draft" — no Sent, Accepted, Rejected, Expired statuses anywhere.

### Request detail
Could not reach a Request detail page — Requests filter shows "Start typing to search" with no recent items, and the Home "0 new requests" link bounces to `/dashboard/requests` (out of crew app). So crew-side request detail is effectively unreachable through normal navigation.

### Invoice / Expense / Payment detail
- **No detail pages found in the crew namespace** for invoices, expenses, or payments. The Search filters don't include them; the More menu doesn't either; the FAB Create flows for them don't lead to viewable detail pages from inside the crew app.

---

## CROSS-CUTTING ISSUES (apply across many screens)

1. **Crew app vs Dashboard split is leaky.** Dozens of links jump from the mobile crew app into the desktop dashboard with no return path. Anything tagged "manage", "settings", or "all" in the crew app is actually a redirect.
2. **Lots of "COMING SOON" stubs in production:** Upload images (Request, Expense), Line items (Request, Job, Invoice), Schedule (Request), Reimburse-to (Expense), Attach receipt (Expense), Invoice details (Invoice), Line items + scheduling (Job), full mobile quote builder.
3. **No edit anywhere.** Client, Job, and Quote detail pages have no Edit affordance. The user can only create or view; they cannot fix.
4. **No back navigation primitive** other than the system back button or the close (✕) button on overlays. There's no breadcrumb, no "back to client" link from a job, etc.
5. **Demo data is live in production:** "Showcase" client, "Test Lead", `(Unnamed client)`, "Report totals:" — these should be cleaned out.
6. **Duplicate records are not detected.** Linda Rose × 3 with identical phone / email / address. No de-dupe routine on save.
7. **Validation is silent.** Errors are either pushed to the URL query string (Client form) or shown only as a green border (Task form). No toast, no inline message, no scroll-to-error.
8. **Phone numbers are not formatted, emails are not validated, addresses are not verified.**
9. **Terminology inconsistency:** "Project" vs "Job", "Visit" vs "Schedule", "Request" vs "Lead", "Quote" vs "Estimate" — pick one.
10. **No offline mode / no sync indicator.** A field service app needs offline capture; nothing here suggests it exists.
11. **Two header icons (calendar, filter/sort) on Schedule are dead.**
12. **Notifications system advertises but never delivers.** Bell badge increments; no notifications page exists.
13. **Hydration mismatches and a parentNode null-deref are firing on every page load**, and twice during this audit the renderer froze for 30+ seconds.
14. **Off-by-one date** on Expense form, Quote `Issued` date, and quote ID — looks like UTC vs America/Los_Angeles is wrong server-side.

---

## QUICK FIX PRIORITY LIST

**Block release until fixed (Sev 1):**
1. Quote-template tap silently creating phantom $0.00 Draft quotes attached to the wrong client (Critical #1).
2. Default search returning the recent feed instead of filtered results (Critical #2).
3. Notification bell linked to `/crew/more` (Critical #3).
4. "Clock In" doing nothing (Critical #4).
5. Off-by-one date / wrong timezone on Expense, Quote ID, Quote Issued date (Critical #7).

**Sev 2 (broken UX, not data corruption):**
6. Two different "this week" definitions between Home and Timesheet (Critical #8).
7. Every "To do" item and every More-menu item kicks the crew member out to `/dashboard/...` (Critical #5).
8. React #418 hydration errors and the `parentNode` null-deref freezing the renderer (Critical #6).
9. Profile and Manage team going to the same URL (More menu).
10. Map "View all" opening Google Maps in a new tab.

**Sev 3 (missing functionality / polish):**
11. Validation messages must render in the UI (not the URL bar).
12. Phone formatting, email validation, address verification, duplicate detection on Client save.
13. Job detail page needs every actually-useful field added (address, scope, photos, status, time tracking, materials, etc.).
14. Quote detail needs Edit / Add Line Item / Send / Convert to Job actions.
15. Build out the "COMING SOON" stubs (photo upload everywhere, line items, scheduling, full mobile invoice/quote builder, reimbursable expenses).
16. Clean demo / test data out of production: Showcase client, Test Lead, (Unnamed client), "Report totals:", duplicate Linda Rose rows.
17. Convert Support and Refer-a-friend `mailto:` links to in-app screens.
18. Add a current-time indicator to Day view; add bigger, interactive map with day's visit pins to Map view.
19. Add "My next visit / Get directions" card to Home.
20. Reconcile the two quote-numbering schemes (`2026-0427-298` vs `#192`).
21. Strip admin-only items (Subscription, Refer a friend, Manage team, Company details) out of the crew More menu — they belong in the dashboard.
