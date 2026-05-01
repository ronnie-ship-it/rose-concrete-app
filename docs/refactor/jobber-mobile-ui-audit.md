# Jobber Mobile App — UI Audit (Day 1)

**Captured:** 2026-04-30
**Sources used:**
- Apple App Store listing for *Jobber Field Service Software* (5 marketing screenshots)
- getjobber.com `/features/field-service-management-app/` (hero shot showing 2 mobile screens — lock-screen notifications + dashboard)
- Companion document: `jobber-deep-ui-audit.md` (web app, captured Apr 21–22, 2026)

**Purpose:** structural reference for Rose Concrete's `/crew` mobile app. This document captures layout conventions, navigation patterns, screen flow, and information density choices visible in publicly-marketed Jobber mobile screens. It is **not** a pixel reproduction or a cloning template — Rose Concrete's app should consume Phase 2's brand tokens (sandiegoconcrete.ai navy/teal/cream) and apply *these structural patterns* to its own visual identity.

> **Coverage limit:** every screen in this Day 1 audit is one Jobber chose to publish in marketing. Login-walled screens — the Add Client form, Settings, individual visit detail edit, etc. — are not covered. A Day 2 pass needs your own Jobber app screenshots to finish coverage. See §10.

---

## §1. Global mobile chrome

### Bottom nav (5 items)
Visible in the published Job-detail screen. Five tabs across the bottom edge:

1. Home
2. Schedule
3. Timesheet
4. Search
5. More

This is the same five-item set Rose's existing `/crew` app already uses. **Keep it.** No reason to change the order, count, or labels — they map to the trade-standard expectations a Jobber-trained crew member already has.

### Header (per-screen)
A consistent pattern across the screens visible:
- **Back chevron** at top-left when inside a detail screen.
- **Screen-context icons** at top-right — on the Job detail screen the right-side cluster is small icons (looks like phone, message, more-actions / overflow). Header is white with thin bottom hairline.
- **Status pill** below the header on detail screens (e.g. *"Action required"* on Job detail, with a colored dot prefix).

Rose's `/crew` header should follow the same pattern: back chevron when in a detail view, contextual quick-action icons at the right (call/text/etc. on Client and Job detail), status pill below.

### Floating Action Button
Visible on the Job-detail screen as a circular green "+" FAB at bottom-right, sitting above the bottom nav. Standard speed-dial pattern matching what's already specified in Phase 3 §0.

### Sheets (modal sub-actions)
"Collect payment" appears as a bottom-anchored sheet over the Invoice screen — payment amount, payment method, etc. The pattern: any sub-action that needs a few more fields opens a sheet from the bottom edge rather than navigating to a new full page. Dismissable via swipe-down or a "✕" in the sheet's top-right.

**Adopt this:** for things like "Mark visit complete," "Collect payment," "Send invoice," "Add line item," "Convert quote to job" — use a bottom sheet, not a full page. Keeps the user oriented.

---

## §2. Dashboard / Home patterns

### From the App Store screenshot ("Connect to Jobber wherever and whenever you work")
Top-to-bottom on the Home screen:
1. **Date + greeting line** — *"Monday, February 23 / Good morning, Neil"*
2. **Section: Workflow** — three side-by-side count tiles (numeric value + small label). Visible counts: 21, 16, 21.
3. **Section: Today's Appointments** — heading row + a row of dollar-figure badges along a timeline strip ("$28,143 / $12,300 / $3,423 / $5,052 / $6,423").
4. (Below the visible viewport — likely visit cards.)

A second mockup overlay on the same image shows a *map view* with a route line, "8:00 AM" pin labeled "Get Map," the user's photo, and "5 visits worth $10.7k / 1 visit complete" beneath.

### From the getjobber.com features hero
A different Home variant:
1. **Header**: Settings gear (top-left), "Jobber" wordmark/centered or right.
2. **Date header**: *"Tuesday, September 28th"*
3. **KPI line**: *"5 visits worth $6.2K"*
4. **Progress line**: *"2 visits completed"*
5. **Visit card** (single, expanded): client name, type label ("To Go"), time range, dollar amount.
6. **"View all appointments"** link.
7. **Sectioned to-do list** below — each section is a row with chevron:
   - Requests — "9+ New" / "9+ Assessments completed" (sub-items shown)
   - Quotes — "2 Changes requested"

### Pattern observations
- **Dashboard is a single scrollable column** — no tabs, no segmented controls. Stack of sections, each tappable.
- **Money-as-a-headline.** Both variants put dollar figures front-and-center: total day value, visit value, KPI line. Crew home isn't just "what to do" — it's "what's at stake today."
- **To-do counts are filtered to user-actionable buckets.** Not "all open requests" but "9+ new" — only the ones that need the user to do something now. Compare to Rose's current Home which dumps "14 require invoicing" without a "and X are yours" filter.
- **One hero visit, then a list.** The features-page screen surfaces a single primary visit card with full detail (client, time, amount), and only links to "view all" for the rest. Rose's Home should pull the same trick: hero "next visit" card, then "View Schedule" link.

### Apply to Rose's `/crew` Home (revising Phase 3 §1)
- Add a money-headline KPI line under the greeting: *"3 visits worth $4.8K today"*. Pull from `visits.value` summed where date = today.
- Replace the current "14 require invoicing jobs" omnibus row with crew-actionable sections:
  - Requests → "X new assigned to me"
  - Quotes → "X awaiting my changes"
  - Jobs → "X starting today"
  - Photos → "X jobs need photos"
- Hero visit card (single, expanded). "View Schedule" is the secondary action.
- Keep the existing "Clock In/Out" card — it's not in Jobber's home but it's higher-value for Rose's specific workflow.

---

## §3. Job detail patterns

### From the App Store screenshot ("27 million+ jobs")
Layout top-to-bottom:
1. **Status pill** at very top: *"Action required"* (with leading colored dot).
2. **Title block**: *"Job for Casey Young for $150.00"* + subtitle *"Monthly Maintenance"*.
3. **Address row**: street, city, ZIP.
4. **Date row**: *"Start date / Nov 27, 2024"*.
5. **Primary action button (full-width pill)**: *"Close Job"* — green background.
6. **Tab bar (segmented)**: Job · Notes (Job is active state, underlined).
7. **Section: Instructions** — heading + body text, chevron at right indicating expandable.
8. **Section: Job forms** — heading + a "+" button at the right, then list ("On site checklist").
9. **Bottom nav** + **green FAB**.

### Pattern observations
- **Hero CTA changes with status.** Status = "Action required" → CTA = "Close Job". This is exactly the pattern Rose's Phase 3 §8 already specifies (hero action button keyed to status: Lead → "Convert to Quote", Scheduled → "Start visit", etc.). Confirmed by Jobber's mobile.
- **Tabs inside detail, not separate pages.** Job vs Notes is a tab inside the job, not two separate pages. The tab pattern keeps related context together. Rose's Job detail in Phase 3 §8 specifies "tabs (Overview, Visits, Photos, Time, Forms, Invoices)" — that count is too high for a mobile tab bar (>4 tabs gets cramped). **Revise:** collapse to "Job" (combining Overview+Forms) and "Notes" (combining the activity log) for v1, with a "More" overflow that opens Visits/Photos/Time/Invoices as bottom sheets.
- **Section rows with "+ button" affordance.** Job forms section heading has a "+" inline — tap to add a form. Same pattern works for Photos, Notes, Materials.
- **Money in the title.** *"Job for Casey Young for $150.00"* — dollar value is part of the headline, not buried in a meta row. Adopt this for Rose Job detail title format.

### Apply to Rose's `/crew/jobs/[id]`
- Title format: `{Job Title} for {Client} — ${total}` (e.g. *"Driveway pour for Howard Lyon — $8,450"*).
- Status pill at top, leading colored dot.
- Single hero CTA below the title block, label keyed to status (per Phase 3 §8 — confirmed by Jobber's "Close Job" pattern).
- Two tabs: **Job** (combines scope, instructions, forms) and **Notes** (activity log).
- "More" overflow in the header opens a sheet exposing Visits, Photos, Time, Invoices.
- Section rows with inline "+" affordance — `Job forms`, `Photos`, `Time`, `Materials`.

---

## §4. Quote / Invoice patterns

### From two App Store screenshots
- **Invoice screen ("Get paid faster")**: Status pill *"Draft"*, *"Invoice for Casey Young for $150.00"*, subtitle *"For Services Rendered"*, meta rows (Issued / Due), two side-by-side primary buttons — *"Send"* and *"Collect Payment"* — with a more-actions ellipsis. Bottom anchored.
- **Invoice review ("Invoice instantly")**: A "Review invoice" sheet with line items (qty, unit cost, total), client name, dates, line items in a structured table. Dismiss "✕" at top-left.
- **Collect Payment sheet** (overlaid on the invoice screen): payment amount field, payment method picker (showing a Mastercard with last-4 and "Default" tag).

### Pattern observations
- **Two primary actions side-by-side at the bottom for invoice.** Both are pill-shaped buttons; the more frequent action ("Collect Payment") gets the larger visual weight. Adopt for Rose's Quote and Invoice detail action footers.
- **Review-before-send is a sheet, not a separate page.** Tapping "Send" opens a "Review invoice" sheet — full content review with confirm-or-cancel — instead of navigating to a `/review` page. Same applies to "Send quote" on quote detail.
- **Payment collection flow is a sheet stack.** Amount → method → confirm — each step in a sheet, never leaves the invoice context.

### Apply to Rose's `/crew/quotes/[id]` and `/crew/invoices/[id]` (revising Phase 3 §9 and §11)
- Action footer = two primary buttons side-by-side (e.g. *Send* + *Convert to Job* on Quote; *Send* + *Collect Payment* on Invoice). Overflow ⋯ for Edit / Duplicate / PDF / Delete.
- "Send" opens a Review sheet, not a separate page. Sheet shows what the customer will see, has a single Confirm button.
- Payment collection is a sheet flow within the Invoice screen, never a separate route.

---

## §5. Notification patterns

### From the lock-screen image on the features hero
Two notification rows visible on a phone lock screen:
- *"JOBBER · now / **New Booking Request** / New booking request for Hilary Smith"*
- *"JOBBER · now / **Quote Viewed** / Casey Young viewed a quote"*

### Pattern observations
- **Push titles are event-shaped, body is named.** Title = the type of event ("New Booking Request"), body = which specific entity ("for Hilary Smith"). Consistent template.
- **Two-line maximum.** No verbose body. Crew can glance and decide.

### Apply to Rose's notifications
- Push notification template: `Title: {EventType}`, `Body: {EntityName}` ± a one-line context. Examples:
  - *New visit assigned* / *Howard Lyon — Tomorrow 8:30 AM*
  - *Quote viewed* / *Federico Escobedo — 516 Forward St*
  - *Invoice paid* / *Linda Rose — $1,250*
- In-app `/crew/notifications` rows mirror this title/body shape — see Phase 3 §5.

---

## §6. Customer messaging pattern

### From the App Store screenshot ("Save 7 hours per week")
A conversation thread for "Casey Young":
- Header: back chevron + client name + ⋯ (overflow).
- Conversation bubbles in a vertical list — outgoing on the right (lighter), incoming on the left.
- Each bubble has a timestamp.
- A previous outgoing message includes a "[PRIVATE CLIENT HUB LINK]" placeholder where Jobber injects the live URL when sending.
- An automated reminder bubble shows the templated reminder text.

### Pattern observations
- **Stored conversations.** All texts/messages live inside the customer record, not just in a separate inbox. Compare: Rose's current crew app has no customer message thread at all.
- **Templated automation lives inline** with manual messages. The user sees what was auto-sent and can respond from the same thread.
- **Smart-link injection.** Send template contains placeholders ([CLIENT NAME], [VISIT TIME], [HUB LINK]) that hydrate at send time.

### Apply to Rose's `/crew/clients/[id]`
- Add a **Messages** section to client detail (Phase 3 §7). Tap → conversation thread per client.
- Wire to OpenPhone (already a connector in Rose's stack) — pull SMS history per phone number, show inline.
- Templated outgoing messages: "On my way," "Running 15 min late," "Job complete — thanks for the work." Each gets a single-tap send button at the top of the thread.
- This is a Phase 4 feature, not Phase 1–3. But the data model should plan for it — `messages` table keyed by `client_id` with `direction`, `body`, `sent_at`, `template_id` (nullable).

---

## §7. Color and visual identity (observation, NOT for cloning)

### What Jobber's visual identity is
- Dominant green accent throughout (CTAs, FAB, brand mark) — `~#A4F435` to `~#65C82D` range.
- Dark navy header backgrounds in some screens; white card surfaces.
- Lots of off-white card backgrounds, hairline dividers.

### What Rose Concrete's app uses (Phase 2)
- Brand-900 navy `#1b2a4a` (from sandiegoconcrete.ai).
- Accent-500 teal `#2abfbf`.
- Cream-300 `#f5efe0` warm surface.

### The point
Rose's app should **not** adopt Jobber's green. The structural patterns (hero CTA, status pill, sheet flows, two-tab job detail) are what make a Jobber-trained crew feel at home. The colors are what make the app feel like Rose Concrete. Don't conflate them.

If anywhere in the codebase still has `#1A7B40` (the old Jobber-green-mimic from before the brand rework), Phase 2 PR-G/PR-H replaces it with the navy/teal token system.

---

## §8. Density and typography observations

- **Dense but not cramped.** Both Home variants pack 4–6 sections in a single mobile viewport. Section headings are uppercase tracked (~12 px), body is 15–17 px, large numbers/headlines are 24–28 px.
- **Big numbers, small labels.** KPI tiles use ~28 px numerals over ~12 px labels — a 2.5× ratio. Eye sees the number first.
- **Right-aligned chevrons.** Every tappable row has a `>` chevron at the right edge, signaling "tap for detail."

These match Rose's Phase 2 type scale (`--fs-md: 15px` body, `--fs-2xl: 24px` headline) closely. Minor adjustment: bump section heading tracking and weight to match Jobber's slightly punchier hierarchy.

---

## §9. Updates this audit recommends to existing briefs

| Brief / section | Update |
|---|---|
| **Phase 3 §1 (Crew Home)** | Add a money-headline KPI line. Refactor "to do" rows to be crew-filtered ("assigned to me"). Hero "next visit" card + "View Schedule" link. |
| **Phase 3 §8 (Job detail)** | Title format includes dollar amount. Two tabs (Job + Notes), not six. Move Visits/Photos/Time/Invoices into a "More" sheet. Hero CTA keyed to status — confirmed by Jobber's "Close Job" example. |
| **Phase 3 §9 (Quote detail)** | "Send quote" opens a Review sheet, not a separate page. Action footer = two primary buttons + overflow. |
| **Phase 3 §11 (Invoice detail)** | Two primary buttons (Send + Collect Payment) side-by-side. Payment collection is an in-screen sheet flow. |
| **Phase 3 §0 (shared chrome)** | Reinforce: bottom sheet for any sub-action with 1–4 fields. Don't navigate; sheet. |
| **Phase 3 §7 (Client detail)** | Add a **Messages** section sourcing from OpenPhone — Phase 4 work, but data model planning starts now. |
| **Phase 4 (deferred features)** | Add "Customer messaging thread per client" as a tracked feature with the OpenPhone integration. |

---

## §10. What's missing from this audit (needs Day 2)

The marketing screens cover ~7 distinct screens. Login-walled screens not covered:

- Add Client form (the screen where Rose's bug 1 + bug 2 live)
- Add Visit / Schedule a visit
- Add Quote / mobile quote builder
- Add Invoice / mobile invoice builder
- Settings / preferences
- Profile screen
- Search results UI
- Timesheet (clock in/out flow detail)
- Notifications inbox
- Visit detail (vs Job detail — different screens?)
- Photo upload flow
- Client list with filters

If you can spend ~15 minutes opening your Jobber mobile app and screenshotting these screens (especially the Create flows and Settings), drop the images into your workspace folder under `jobber-mobile-screenshots/` and I'll fold them into a Day 2 audit. That's the one thing that materially improves on what I have here.

Specifically the Add Client form would be highest-leverage — it's the screen Rose's app currently breaks on, so seeing exactly how Jobber lays it out (field order, footer position, address autocomplete UI, validation copy) tells us exactly what to build.

---

## §11. Hard line on what we're NOT doing

This audit is structural reference. It is **not** a cloning playbook. Specifically:
- Do not copy Jobber's green palette, brand mark, illustrations, or any proprietary visual asset.
- Do not reproduce Jobber's exact icon set (icons that match common conventions are fine — phone, message, calendar — but custom-designed Jobber icons are off-limits).
- Do not lift Jobber's exact wording verbatim. The patterns ("Status pill keyed to action required") translate; the literal copy ("Action required") gets rewritten in Rose's voice.
- The Jobber app's distinctive look is their commercial product. Rose Concrete's app is a different product with its own identity (sandiegoconcrete.ai navy/teal/cream). Structural parity is the goal, not surface mimicry.

This is the same line drawn at the top of `jobber-deep-ui-audit.md`. Holding it.
