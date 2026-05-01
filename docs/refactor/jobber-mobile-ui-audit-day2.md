# Jobber Mobile App — UI Audit (Day 2 Fold-In)

**Captured:** 2026-04-30
**Source:** 21 screenshots taken inside the Jobber iOS app on Ronnie's phone (`jobber-mobile-screenshots/IMG_4943.png` through `IMG_4963.png`).
**Companion:** `jobber-mobile-ui-audit.md` (Day 1, public sources only)

**What this adds:** screens that were login-walled in Day 1 — Add Client form, Add Task form, Add Client picker, Schedule Day/List/Map, Search, More menu, Manage Team, Preferences, Company details, View Options sheet, Map cluster behavior. With these in hand, several Day 1 hypotheses are now confirmed or corrected, and the form-hotfix fix pattern is now precise instead of speculative.

> **IP discipline still holds.** This document captures structural patterns in my own words. Do not lift Jobber's icons, illustrations, copy ("Add From Contacts," "Active timer," etc.), or accent palette. Adapt the patterns to Rose Concrete's identity (sandiegoconcrete.ai navy/teal/cream).

---

## §A. The single most important finding for the form hotfix

### Save button is INSIDE the scroll, not a sticky/fixed footer.

Looking across every form screen Ronnie captured — Add Client (IMG_4945–47), Add Task (IMG_4948), Company details (IMG_4959–60) — the primary CTA is the last visible item at the bottom of the form's natural scroll flow.

There is **no fixed footer**. The Save button is a regular full-width pill button rendered at the bottom of the scrollable form. When the keyboard slides up, the form scrolls with it; the Save button moves out of the visible viewport along with the rest of the form below the focused field.

**This means Bug 1 (Save button cutting off the address) is caused by Rose's app using a sticky/fixed footer pattern that Jobber doesn't use at all.** Removing the sticky footer and putting Save inline at the end of the scroll *eliminates* the overlap. There's nothing to overlap when nothing is sticky.

### Updated fix for PR-A1 (form hotfix brief)

The Phase 1.5 hotfix brief proposed three fix paths: padding + sticky-footer + scrollIntoView. **Throw out the sticky-footer path entirely.** Replace the Bug 1 fix with this simpler approach:

1. **Render Save and Cancel as the last items in the form's scroll, not a footer.** Buttons are siblings of the form fields, not children of a footer container.
   ```tsx
   <form className="px-4 pb-8 space-y-4">
     {fields}
     <div className="pt-4 space-y-3">
       <SaveButton />     {/* full-width, --brand-900 bg */}
       <CancelLink />     {/* text link, centered */}
     </div>
   </form>
   ```
2. **No `position: fixed`. No `position: sticky`. No backdrop blur.** Just normal document flow.
3. Page-level layout still has the bottom nav (`<CrewBottomNav>`) sticky at the viewport bottom — that's untouched. The form *body* scrolls; the bottom nav doesn't. When the keyboard appears, iOS resizes the visual viewport and both the form scroll and the bottom nav adjust correctly.
4. **Add `padding-bottom: env(safe-area-inset-bottom)` to the form body** so iPhones with home indicators don't truncate the Save button on long forms.
5. Keep the `scrollIntoView` helper from the Phase 1.5 brief — it's still useful for jumping to error fields after submit-fail.

The TextField fix for Bug 2 (font-size 16px, `-webkit-text-fill-color`, caret-color) stays exactly as written in the original brief.

---

## §B. Day 1 hypotheses — confirmed, corrected, or adjusted

| Day 1 hypothesis | Verdict | Notes |
|---|---|---|
| 5-item bottom nav: Home, Schedule, Timesheet, Search, More | **Confirmed.** | Visible on every screen Ronnie captured (IMG_4943, 4953, 4954, 4955, 4956, 4957, 4958, etc.). |
| FAB at bottom-right with speed-dial of 7 create options | **Confirmed and refined.** | Speed-dial order bottom-up: Client, Job, Quote, Invoice, Expense, Task, Request (IMG_4944). Closest-to-thumb is Client — most-used create. |
| Header pattern: ✕ left, screen title centered, contextual icon right | **Confirmed.** | Every Add/Edit screen uses this. Right-side icon is the AI sparkle ("✨") on Jobber. Rose's app should put a contextual help/action icon there instead. |
| Status pill at top of detail screens with leading colored dot | **Confirmed.** | Detail screens show "Lead", "Upcoming", "New", etc. as right-side pills with colored dots in lists; status-as-context-banner appears at top of detail. |
| Forms are top-down, single column, full-width inputs | **Confirmed.** | All Add/Edit forms on mobile are pure scrolls. |
| Hero CTA below title block, label keyed to status | **Confirmed.** | Add Client → "Save" full-width pill. |
| Bottom sheets for sub-actions | **Confirmed.** | Date picker (IMG_4949), Map pin detail (IMG_4962), View Options (IMG_4961) all use bottom sheets. |
| Job detail uses 2 tabs (Job, Notes) | **Carried over from Day 1 App Store screenshot — Ronnie's set doesn't have a Job detail to confirm.** | Still recommend 2 tabs; awaits confirmation in Day 3 if available. |

---

## §C. New structural patterns observed in Day 2

### C.1 Forms use a "collapsed-until-tapped" field reveal pattern

The Add Client form (IMG_4945–47) is the cleanest example. Initial state shows:
- First name input
- Last name input
- Property address input

…plus a list of **tappable text-link rows** in the brand color:
- "Add Company Name"
- "Add Phone Number"
- "Add Email"
- "Add Lead Source"
- "Add Additional Info"

Tapping any of those expands the row into a real input. Empty fields don't take up vertical space until the user opts in.

**Why this matters:** the form looks short, the user sees a ~6-input form instead of a ~15-input form, and required vs optional fields are visually separated.

**Apply to Rose's `/crew/create/client`:** First name + Last name + Property address are always shown (Property address is the practical primary key for a concrete client). Phone, Email, Company Name, Lead Source, Notes, Tags, Preferred contact method, Second contact — all start as "Add X" tap-to-reveal rows.

### C.2 Form fields have leading icons

Each "Add X" row has a small leading icon: phone icon for phone, envelope for email, building for company, location pin for address, slider for lead source. Icons are monochrome (matching the section's color), about 16–18 px.

**Apply to Rose:** add leading icons to each tap-to-reveal row in `<TextField>` / `<AddressField>` / etc. — uses Lucide or Heroicons (already permissively licensed). Don't reproduce Jobber's specific icon set; just adopt the placement pattern.

### C.3 Form sections are separated by thin gray bands, not card edges

Between groups (name fields → "Add X" rows → property address), there's a thin (~6 px) light-gray band that visually separates groups without using card borders or shadow. It's a single-color band running edge-to-edge of the form width.

**Apply to Rose:** instead of rendering each group as a card with its own border, use a single white form surface with `--cream-300` thin separator bands (~6 px tall, full width) between groups. Cleaner look, easier to implement.

### C.4 "Add From Contacts" appears as the very first row of the New Client form

The Add Client form's top row, above First Name, is a full-width outlined pill button: **"Add From Contacts"** (with a person-add icon). It's the prominent zero-effort path — pull a real contact from your phone's address book.

The current Rose `/crew/create/client` had this as a permanently-disabled button per the original audit (Contact Picker isn't supported on iOS Safari). On native (which Jobber is), this works.

**Apply to Rose:** since Rose's app is a PWA running in mobile Safari/Chrome, the Web Contact Picker API is iOS-Safari-only at very recent versions and Android-Chrome-only. The button should:
- On Android Chrome: invoke `navigator.contacts.select(['name','tel','email'], {multiple:false})` and prefill the form.
- On iOS Safari: route to a single-screen picker that asks for the share-sheet with instructions, or simply hide the button. (The Phase 1.5 brief already covered this — confirmed correct here.)

### C.5 Schedule has 5 view modes, not 3

Day 1 audit assumed Day / List / Map (matching Rose's current crew app). Day 2 confirms Jobber actually offers **Day / List / 3 Day / Week / Map** — five view modes.

The View Options sheet (IMG_4961) lets the user toggle:
- Show unscheduled appointments on Map view
- Show weekends on Week view

…and select which team members to include via a checklist.

**Apply to Rose's `/crew/schedule` (revising Phase 3 §2):** add 3 Day and Week as view modes alongside Day, List, Map. View Options should be a sheet accessible from the filter icon in the sub-header — already specced in Phase 3 §2 as a "filter sheet"; expand it to include view-toggle settings and team-member multi-select.

### C.6 Schedule supports per-assignee column view

In **List view (IMG_4952)** and **Day view (IMG_4953)**, each crew member gets a vertical column. Each column header shows the assignee's name + completion progress ("Roger witthoeft 2/5", "Thomas Ronnie... 2/5").

Each task card within a column shows:
- A teal/cyan left-edge stripe
- Title
- Client name
- Time range
- Address
- Strike-through styling on completed items

In **Map view (IMG_4954)**, the same column headers appear above the map, also showing per-assignee totals.

**Apply to Rose:** this is much more powerful than Rose's current single-column schedule. For an admin/foreman view, each assignee gets their own column. For an individual crew member view, only their column. Pattern goes in Phase 3 §2 as a **revision** — current spec assumes single-column scheduling.

### C.7 Map view has cluster pins with team member initials

When multiple jobs are at nearby locations, pins cluster (IMG_4954, IMG_4963). The cluster shows initials of the team members assigned (e.g. "TR", "TRF"). Tapping the cluster either expands or shows a chevron-up to drill in.

Tapping a single pin opens a **bottom sheet** with the visit detail (IMG_4962): time range, title, client name, address, team avatars on the right.

**Apply to Rose's `/crew/schedule/map`:** adopt cluster behavior for overlapping locations. Pin tap → bottom sheet with visit detail + "Open in Maps" + "View Job" actions. Phase 3 §2c already specifies bottom-sheet on pin tap; confirmed.

### C.8 Search results stream multiple entity types in one feed

The Search screen (IMG_4955) under "Recently active" mixes Clients, Requests, Quotes, Jobs in one chronological list. Each row has:
- Leading icon indicating type (person silhouette = Client; inbox = Request; hammer = Job; magnifier = Quote)
- Bold name
- Meta line: "Today | [address or context]"
- Right-side status pill ("Lead", "Upcoming", "New") with colored dot

The pills above the search input filter to a single type. Tapping "Clients" filters to clients only.

**Apply to Rose's `/crew/search` (Phase 3 §4 — confirms the spec):** type pills filter; default is "All" (mixed feed). The mixed feed includes `recently active` rows from all entity types. Confirmed by Day 2.

### C.9 More menu has 11 items, not 5

Day 1 + Phase 2 §2 recommended trimming Rose's More menu down to 5 items (Notifications, Support, Profile, About, Sign out) and stripping admin items.

**Jobber's More menu (IMG_4956) has 11 items:**
- 2-up tile: Apps & integrations | Marketing
- List: Support, Subscription, Product updates, Refer a friend, About, Profile, Manage team, Company details, Preferences
- Logout (red text)

Jobber doesn't differentiate admin vs non-admin More menus. Every user sees everything; the rows that require admin permission are gated server-side when tapped.

**Reconciliation for Rose:**
- For the **owner / admin** view (Ronnie): adopt the full Jobber-style More menu — Apps & integrations (when implemented), Marketing, Support, Subscription, Product updates, Refer a friend, About, Profile, Manage team, Company details, Preferences, Logout.
- For **non-admin crew members**: still show a trimmed version — Support, About, Profile, Preferences, Logout. Admin-only items hidden by role.
- This is more permissive than Phase 2 §2's strict trim. Update Phase 2 §2 to read: "More menu shows admin items to admins only; non-admin role sees Support / About / Profile / Preferences / Logout."

### C.10 Preferences screen exists and is mostly notification toggles

The Preferences screen (IMG_4958) has only one section visible: **Push notifications**. Toggle switches for:
- Today's work overview
- Today's schedule changed
- New request
- New online booking
- Client viewed quote
- Client approved quote
- Active timer

All Apple-style pill switches (green when on).

**Apply to Rose's `/crew/preferences` (new screen, was unstubbed):** mirror this. One section ("Push notifications"), seven toggles matching Rose's actual notification events. When a toggle is on, register the user for that push topic; when off, unsubscribe. Server-side stored on `user_preferences` table.

### C.11 Manage Team is a flat list with a "+" to add

Manage Team (IMG_4957) is a one-screen flat list of team members. Each row is the member's name + right chevron. "+" in the header to add. Tap a member → presumably a detail/edit screen (not in the captures).

**Apply to Rose:** for admin-only access, /crew/team list with add button. Tap → /crew/team/[id] detail.

### C.12 Company details is a long inline-save form

Company details (IMG_4959, IMG_4960) is just a vertical scroll of all company-level fields — name, email, phone, website, location subsection (property name, address, city, state, zip, country). Save at bottom of scroll, inline.

**Apply to Rose's `/crew/company-details` (admin-only):** mirror — long form, inline Save.

### C.13 Date picker is a native-feeling iOS modal

The date picker (IMG_4949) is a calendar grid in a bottom-anchored white sheet. Today (Apr 30) highlighted in a blue circle. "Confirm" and "Cancel" as separate sheet pills below.

**Apply to Rose:** use `<input type="date">` for the simplest path — iOS will render a similar native picker. If you need a custom one, mimic this layout (calendar grid in bottom sheet, today highlighted in `--accent-500`, Confirm/Cancel as separate pills).

### C.14 Status pills appear right-aligned in list rows with leading colored dots

Search results (IMG_4955) show right-aligned pills with colored dots:
- "Lead" with a teal dot
- "Upcoming" with a teal dot
- "New" with a yellow/amber dot

Phase 3 §0's `<StatusPill>` component spec uses this pattern; confirmed. Add the **leading colored dot** to the StatusPill spec — currently the spec says "pill with text and color"; reality is "pill with leading dot + text."

---

## §D. Where Day 2 changed my recommendations

| Brief / section | Day 1 said | Day 2 says (revised) |
|---|---|---|
| Phase 1.5 form hotfix Bug 1 | "Use sticky footer + bottom padding + scrollIntoView" | "Render Save inline at end of form scroll. No sticky footer." Simpler, removes the bug at its root. |
| Phase 2 §2 (More menu) | "Trim to 5 items, strip all admin" | "Role-aware: admins see full menu; non-admins see trimmed 5." |
| Phase 3 §2 (Schedule) | "3 view modes (Day, List, Map)" | "5 view modes (Day, List, 3 Day, Week, Map). Per-assignee columns. View Options sheet for filters/toggles." |
| Phase 3 §0 (StatusPill) | "Pill with text + color" | "Pill with leading colored dot + text + color." |
| Phase 3 §12 (Create forms) | "Required fields shown, all visible" | "Required fields visible; optional fields rendered as 'Add X' tap-to-reveal links until tapped." |
| Phase 3 §1 (Crew Home) | "Hero next-visit card + section list" | "When no visits scheduled: show a 'Schedule a New Job' inline CTA card (IMG_4951 confirms this empty-state pattern)." |
| Phase 3 §6 (Crew More) | "5 items, all crew-side routes" | See More-menu reconciliation above (role-aware). |
| Phase 3 (new) | — | Add `/crew/preferences` (notification toggles), `/crew/company-details` (admin), `/crew/team` + `/crew/team/[id]` (admin). |

---

## §E. PR-A1 form hotfix — final fix list (replaces Phase 1.5 Bug 1 section)

When Claude Code picks up `refactor/pr-a1-form-mobile-hotfix`, the diff should be smaller than the Phase 1.5 brief originally planned:

1. **`<CreateFormShell>` component** (still new):
   - Renders a vertically-scrollable form body.
   - **No footer prop.** No sticky/fixed positioning anywhere.
   - `padding-bottom: env(safe-area-inset-bottom) + 16px` so the last row doesn't hit the home-indicator zone.
2. **Form pages** (e.g. `/crew/create/client`) render their fields followed by an inline `<SaveButton>` and `<CancelLink>` as the last children of the form.
3. **`<TextField>` component** still gets the 16px font-size + `-webkit-text-fill-color: var(--text)` + `caret-color: var(--brand-900)` fix from the original Phase 1.5 brief — that addresses Bug 2 (invisible typing) and stands.
4. **Optional fields render as tap-to-reveal rows** (matching §C.1) — each row is a button that swaps to a `<TextField>` on tap. Only First/Last name + Property address shown by default in Add Client.
5. **scrollIntoView helper** on focus (from original Phase 1.5 brief) stays — handles edge cases when the keyboard hides the focused field.

This is **smaller, simpler, and more correct** than the original Phase 1.5 plan. Net: less code, fewer moving parts, fix is at the architectural level rather than at a layering hack.

---

## §F. What's still not visible (Day 3 candidates)

Even with 21 screenshots, these screens didn't make it in. If you want a Day 3 pass:

- Job detail page (the actual /jobs/[id] view inside Jobber — confirms or refines the Day 1 web-screenshot inference)
- Quote detail page
- Invoice detail page (beyond the marketing screenshot)
- Visit detail (separate from Job detail?)
- Client detail page (current view, not the picker)
- Add Job, Add Quote, Add Visit, Add Invoice forms (only Add Client + Add Task captured)
- Photo upload flow
- Forms / checklists screen
- Time entry detail (Clock In/Out beyond the home button)
- Notifications inbox (not just push prefs)
- Quote builder mobile flow
- Edit Client form (in case it differs from Add Client)

Roughly 12 screens. If you have time for another pass on your phone, screenshot those next and drop them in the same folder. Day 3 audit then confirms the remaining Phase 3 specs against reality.

---

## §G. Definition of "close enough to Jobber on a phone"

Putting a stake in the ground on what "looks like Jobber" actually means now that we have ground truth:

The crew app is "close enough" when, comparing screen-by-screen against Ronnie's screenshots, every Rose screen has:
1. The same **navigation skeleton** (5-item bottom nav, FAB with speed-dial create, header with ✕/back + title + contextual icon).
2. The same **information density** (cards stacked vertically, single-column, hairline dividers, leading icons on field rows, status pills right-aligned with colored dots).
3. The same **interaction patterns** (forms scroll, Save inline; sub-actions in bottom sheets; collapsed optional fields; per-assignee columns on Schedule).
4. The same **terminology** (Job, Visit, Request, Quote, Client; not Project, Schedule entry, Lead, Estimate).

It is **not** "close enough" by reproducing:
- Jobber's green palette (Rose uses navy + teal + cream from sandiegoconcrete.ai).
- Jobber's logo, brand mark, or distinctive iconography.
- Jobber's exact copy (headlines, button labels, microcopy).
- Jobber's specific font choices.

Once Phase 2 (tokens) and Phase 3 (screens, with the Day 2 revisions above) ship, the crew app should pass this bar. It will *not* pass a "tell two screenshots apart" test — and that's the right outcome both for IP reasons and because Rose deserves its own brand identity.
