# Jobber Deep UI Audit
**Captured:** April 21–22, 2026  
**Account:** Rose Concrete and Development (ronnie@sandiegoconcrete.ai)  
**Browser:** Chrome @ 1440×900  
**Theme:** Dark mode  
**Purpose:** Reference document for rebuilding a Jobber-style app.

> **Legal note (from the author):** Replicating Jobber's exact UI one-to-one for a commercial product carries real trade-dress / copyright risk. This document captures structure, layout, workflow, and terminology for reference. Use it to inform your own design; avoid pixel-identical cloning of distinctive visual treatments.

> **Note on screenshots:** The Chrome browser tool captured screenshots in-context but did not expose a file path for saving them. Rather than ship empty image placeholders, this document relies on rich text descriptions, exact copy, accessibility-tree labels, URL paths, and observed color/layout measurements. Pair with live screenshots if you also need the visuals.

## Table of Contents
1. [Global Chrome](#global-chrome-appears-on-every-page)
2. [Dashboard / Home](#1-dashboard--home-home)
3. [Clients list](#2-clients-list-clients)
4. [Client detail](#3-client-detail-page-clientsid)
5. [New Client form](#4-new-client-form-clientsnew)
6. [Quotes list](#5-quotes-list-quotes)
7. [New Quote form](#6-new-quote-form-quotesnew)
8. [Quote detail](#7-quote-detail-quotesid)
9. [Jobs list](#8-jobs-list-jobs)
10. [New Job form](#9-new-job-form-jobsnew)
11. [Job detail](#10-job-detail-jobsid)
12. [Schedule](#11-schedule-schedule)
13. [Invoices (list + detail)](#12-invoices)
14. [Settings](#13-settings)
15. [Appendix — shared UI components](#appendix--sharedreusable-ui-components)
16. [URL patterns](#state--url-patterns-observed)

---

## GLOBAL CHROME (appears on every page)

### Color palette (observed)
| Token                  | Approx hex      | Where                                                          |
|------------------------|-----------------|----------------------------------------------------------------|
| Page background        | `#121619`       | Main content area                                              |
| Sidebar background     | `#1A1E22`       | Left nav                                                       |
| Card / panel bg        | `#1F252A`       | Cards, widgets                                                 |
| Card border / divider  | `#2A323A`       | 1 px lines between rows, card borders                          |
| Primary text           | `#FFFFFF`       | Headings, numbers                                              |
| Secondary text         | `#AAB2BA`       | Labels, sub-text                                               |
| Muted text             | `#6B7580`       | Placeholder, completed/strikethrough                           |
| Accent green           | `#8FBF4A`       | "Visit" toggle selected, appointment green bar, upsell tags    |
| Accent gold/amber      | `#E8B74A`       | Requests column bar                                            |
| Accent magenta/pink    | `#D46B7E`       | Quotes column bar                                              |
| Accent cyan/blue       | `#4FA8E0`       | Invoices column bar                                            |
| Notification red       | `#E0443C`       | Activity feed badge (24)                                       |
| Button hover outline   | `#8FBF4A` (1px) | "View Schedule" link button                                    |

### Top-level layout
Three regions, full viewport height:

1. **Left sidebar** — fixed width ~158 px, dark background, full height, scrollable.
2. **Header bar** — ~60 px tall, spans from right edge of sidebar to viewport edge.
3. **Main content** — everything below the header and right of the sidebar. Page-specific.
4. **Right rail (Home only)** — ~300 px panel on the right side with "Highlighted" and "Business Performance" widgets. On inner pages the right rail is replaced by contextual panels.

### Sidebar (left nav)
**Width:** ~158 px expanded, collapsible to ~56 px via arrow button at bottom.  
**Top-to-bottom order, with icons:**

1. **Jobber logo** — small green rounded-square "J" icon, top-left corner. ~40 × 40 px. Clicking returns to /home.
2. **Create** (⊕ plus-in-circle icon, white) — opens a horizontal flyout popover with 5 icon/label tiles:
   - **Client** (person silhouette)
   - **Request** (inbox/tray icon)
   - **Quote** (magnifier-on-page icon)
   - **Job** (hammer icon)
   - **Invoice** (dollar sign in badge)
   Icons in the flyout are the Jobber gold/amber accent (`#E8B74A`). Background of the flyout is a darker rounded rectangle with small shadow.
3. Separator (thin divider line, `#2A323A`)
4. **Home** (house icon) — URL `/home`. Currently active: white background fill behind icon+label, pill-shaped.
5. **Schedule** (calendar icon) — URL `/schedule`
6. Separator
7. **Clients** (address-card icon) — URL `/clients?nav_label=Clients&nav_source=sidebar`
8. **Requests** (downward tray icon) — URL `/requests`
9. **Quotes** (magnifier-on-page icon) — URL `/quotes`
10. **Jobs** (hammer icon) — URL `/jobs`
11. **Invoices** (dollar-badge icon) — URL `/invoices`
12. **Payments** (credit-card icon) — URL `/payments`
13. Separator
14. **Marketing** (megaphone icon, chevron-down) — expandable. Submenu when expanded:
    - Reviews
    - Campaigns
    - Referrals
    - Website
15. **Receptionist** (headset icon) — URL `/ai_receptionist`
16. **Pipeline** (funnel / pipeline icon) — URL `/sales`
17. **Insights** (bar-chart icon, chevron-up when expanded) — URL `/insights`. Submenu:
    - **Reports** — URL `/reports`
18. **Expenses** (dollar icon in square) — URL `/expenses`
19. **Timesheets** (clock icon) — URL `/timesheets`
20. **Community** (speech-bubbles icon) — URL `/community`
21. **Apps** (not visible until scroll) — URL `/marketplace`
22. Separator (near bottom)
23. **Refer and Earn** — URL `/accounts/referrals?origin=sidebar`
24. **Collapse Sidebar** arrow (◀) at very bottom.

**Typography in sidebar:**
- Icon size ~20 px
- Label: 14 px, medium weight, white when idle, bolder when active
- Active item has rounded-pill background and subtle left-align
- Padding: ~12 px vertical, ~16 px horizontal per row

### Header bar (top)
**Height ~60 px.** Spans the full content width minus the sidebar.

Left side: "Rose Concrete and Development" in secondary-gray text (14 px). This is the account name, not clickable.

Right side, left-to-right:
1. **Global search box** — rounded, ~300 px wide. Placeholder "Search". Inside the box, on the right, a small keyboard-shortcut badge "/" indicating press slash to focus. Magnifier icon on the left inside the box. Background slightly darker than header.
2. **Upgrade to two-way text messaging** — speech-bubble icon with a small orange "+" badge in the top-right corner. Tooltip on hover.
3. **AI / Copilot icon** — sparkle/starburst icon. Opens Jobber AI features (inferred).
4. **Activity Feed bell** — bell icon with red rounded-square badge showing "24" (unread items). Click opens a right-side activity panel.
5. **Help (?) icon** — round with question mark. Opens Help menu.
6. **Settings (gear) icon** — gear with a small "Updates Available" indicator dot. Opens settings menu / account menu.

Header background is the same dark as the sidebar for a seamless top row.

### Global "Create" flyout content (when Create clicked)
Horizontal strip with 5 tiles side-by-side, each tile shows an icon (gold/amber) above a label in white. Tiles are ~70 px wide, ~80 px tall, light rounded hover state. Popover appears to the right of the Create button and slightly overlays the main content.

---

## 1. DASHBOARD / HOME (`/home`)

### URL
`https://secure.getjobber.com/home`

### Page heading block (top of main area)
- Small gray secondary-color line: `Tuesday, April 21` (date label, ~14 px, `#AAB2BA`)
- Huge greeting heading: `Good evening, Thomas` (~48 px serif-ish bold sans). Greeting adapts to time of day.
- No subtitle.
- Left margin ~32 px from sidebar edge.
- Top padding ~32 px from header.

### Workflow strip (4 cards in a row)
Section label "Workflow" above the strip, 20 px bold.

Four equal-width cards in a single row, each ~280 px wide with ~12 px gaps. Each card has a **colored top border strip** (4 px tall) indicating its column color:

| Card         | Top-border color  | Headline number | Sub-value          | Section label     | Rows                                                                                     |
|--------------|-------------------|-----------------|--------------------|-------------------|------------------------------------------------------------------------------------------|
| Requests     | Gold/amber        | `50`            | —                  | `New`             | `Assessments complete (23)` / `Overdue (8)`                                              |
| Quotes       | Magenta/pink      | `31`            | `$243k`            | `Approved`        | `Draft (15)   $291.3k` / `Changes requested (0)`                                         |
| Jobs         | Green             | `42`            | `$138.6k`          | `Requires invoicing` | `Active (50)   $56k` / `Action required (12)   $29.2k`                                |
| Invoices     | Blue/cyan         | `0`             | —                  | `Awaiting payment`| `Draft (2)   $2,300` / `Past due (0)`                                                    |

**Card anatomy (from top to bottom):**
1. 4 px colored top strip (column color).
2. Small icon + section word (e.g., 📥 Requests) on the same line as a small chevron "›" on the right (implied clickable card).
3. Big number, ~42 px bold (e.g., `50`).  On Quotes/Jobs, a monetary amount in secondary text to the right of the big number.
4. Bold ~20 px label describing the status (e.g., "New", "Approved", "Requires invoicing", "Awaiting payment").
5. Two rows of sub-links, 14 px, with name on left and monetary amount right-aligned on the right. Each sub-row is a separate link that filters the respective list page.

Hover state: entire card gets a subtle lighter background and a thin border appears.

Card click behavior:
- The **main label area** links to the corresponding list page filtered by that status (e.g., Quotes → Approved → `/quotes?status=approved`).
- Each **sub-row link** filters by a specific sub-status (e.g., Draft links to `/quotes?status=draft`).

### "Today's appointments" panel (below Workflow)
Section heading "Today's appointments" (20 px bold).

Panel contains:

**Top summary row** — 5 tiles, each with a gray label above a big number, left to right:

| Label      | Value   | Notes                                  |
|------------|---------|----------------------------------------|
| Total      | `$4,350`| White text                              |
| Active     | `$0`    | Green numeral when > 0 (assumed)        |
| Completed  | `$0`    |                                         |
| Overdue    | `$4,350`| Red when > 0 (assumed; shown in red tone)|
| Remaining  | `$0`    |                                         |

Right-aligned on the same row: a button-style link "**View Schedule**" — thin green/white outlined pill, ~140 × 36 px.  
Link target: `/calendar#day/2026/4/21`.

**Toggle row (below summary):** A segmented toggle with two radio-like pills: `Visit` | `Employee`. Current selection is "Employee" (dark pill background, white text); "Visit" is the alternate (lighter pill). Width ~260 px total.

**Appointment groups** — Each group is a vertical stack. Group header is all-caps 12 px gray (`1 OVERDUE`, `1 ACTIVE`, `0 REMAINING`, `2 COMPLETED`). Under each header, appointment rows are displayed:

Appointment row anatomy:
- Left edge: a 3 px vertical colored accent bar — green for active, slightly desaturated green for overdue/completed, gray for none.
- Client + job title on first line: `Earl parker - Basic Driveway Addtion` (bold white).
- Time range on second line: `2:00 PM - 4:00 PM` (gray ~13 px).
- Right edge: small circular avatar chips with employee initials ("TRR", "RW"). Overlapping slightly when multiple.
- Far-right: dollar amount (e.g., `$4,350`), bold.
- Whole row clickable — navigates to `/work_orders/{id}?appointment_id={id}`.

Overdue appointment example (from screenshot):  
`Earl parker - Basic Driveway Addtion   2:00 PM - 4:00 PM   [TRR][RW]   $4,350`

Active appointment example:  
`Charles Hansen - City Sidewalk in Front of Customers House   7:30 PM - 3:30 PM   [TRR]`

Remaining group shows a full-width empty state box with muted text "No Scheduled Events".

Completed group renders rows with the client/time in strikethrough muted text (e.g., `Richard Jaynes - Driveway estimate   Anytime`).  
Below the list is a full-width gray button "See 1 more visit" which expands the list.

### Right rail — "Highlighted" (top) and "Business Performance" (below)

**"Highlighted" card:**
- Heading "Highlighted" (20 px bold)
- Close button (×) in top-right of the card
- Inside: bold title "Try Marketing Suite, free" with a subtitle "Start a 30 day free trial, then get 50% off for 6 months."
- Call-to-action button: "Start Free Trial" — white/light rounded pill, ~140 × 36 px.
- Graphic on the right: a mock-up of two mini-cards labeled "Reviews" (with 4.7 star rating and "Average rating") and "Campaigns" (with "Open rate 41.3%" and "Revenue $85...").

**"Business Performance" stack** — list of link cards each acting as a mini-metric tile:

1. **Receivables** — heading + chevron right. "1 client owes you". Big number `$1,500` (22 px bold). Below: a mini 3-column table with headers `Client | Balance | Late` and one row `Dylan Leslie | $1,500 | —`. Target `/reporting/client_balance`.
2. **Upcoming jobs** — heading + chevron. "This week (Apr 19 - Apr 25)". Big number `$7,850`. Badge "↑ 1%" in a green pill to the right.
3. **Revenue** — heading + chevron. "This month so far (Apr 1 - now)". Big number `$0`. Target `/insights`.
4. **Upcoming payouts** — heading + chevron. Two rows:
   - `On its way to your bank` — `—`
   - `Processing payout` — `—`
   Target `/payments?tab=payouts`.

Each card is separated by a thin horizontal divider.

### Footer / bottom
No footer; the page simply ends. Intercom chat launcher floats in the bottom-right corner (small circle icon).

### Micro-interactions observed
- Hovering a workflow card: subtle lift + lighter background.
- Hovering an appointment row: background becomes slightly lighter.
- Clicking the top-left logo returns to /home.
- Pressing `/` anywhere focuses the global search.

---

## 2. CLIENTS LIST (`/clients`)

### URL
`https://secure.getjobber.com/clients?order=DESCENDING&sort=UPDATED_AT`

### Page header row
Three elements in a row spanning the main content width:

- **Left: page title** `Clients` — big 32 px bold heading.
- **Right side, two buttons side-by-side:**
  - `New Client` — **primary green button** (~100 × 40 px, rounded, background `#C2E56B`-ish green, black text, bold). Creates a new client.
  - `••• More Actions` — **secondary outlined green button** with three-dots icon, ~130 × 40 px. On click, opens a right-anchored dropdown menu with two items:
    - `Import Clients` (with small import icon)
    - `Export Clients` (with small export icon)

### KPI cards strip (row of 3 + 1 promo)
Below the page header, a row of four cards ~25% width each, with ~24 px gaps:

1. **New leads** — card title, sub-label `Past 30 days`. Big value `42`. Trend pill on the right of the value: red pill `↓ 82%`. Chevron "↗" in the card's top-right acts as a link to `/reporting/leads?dateFilter=createdAt&dateAfter=...&dateBefore=...` (View report).
2. **New clients** — sub-label `Past 30 days`. Big value `12`. Green pill `↑ 50%`. Chevron top-right opens report.
3. **Total new clients** — sub-label `Year to date`. Big value `36`. Chevron top-right opens report.
4. **QBO Sync promo card** (right-most, distinct look) — heading "Sync clients and eliminate double-entry with QuickBooks Online" (underlined), a dark `Sync now` pill button, and a small thumbnail preview of the QuickBooks UI on the right. Close (×) in top-right corner.

Empty-state of KPI cards while loading: a shimmering skeleton bar where the value would be.

### "Filtered clients" section
Below the KPI strip.

- Section heading: `Filtered clients` with a secondary-text count in parentheses e.g. `(397 results)`.
- Below the heading, a **filter toolbar row** containing:
  - `Filter by tag ⊕` — pill-style button with a plus icon on the right. Opens a tag multi-select.
  - `Status | Leads and Active` — pill-style dropdown showing current filter. Clicking opens a popover menu:
    - Search box at top (placeholder `Search status`)
    - Options: **All**, **Leads and Active** (checked, with a check mark), **Leads**, **Active**, **Archived**
  - Far right: `Search clients...` — text input with a magnifier icon on the left, ~280 px wide.

### Clients table
Full-width table with thin divider rows.

**Column headers (left to right):**
| Column       | Sort arrow  | Notes                                                               |
|--------------|-------------|---------------------------------------------------------------------|
| ☐ checkbox   | n/a         | Left-most column, for bulk select                                   |
| Name         | ↕ clickable | Primary column; holds client name + optional property/company below |
| Address      | —           | Full street address, city, state, zip                                |
| Tags         | —           | Badges for applied tags (empty in this view)                         |
| Status       | —           | Colored pill: `Lead` (blue pill) or `Active` (green pill)            |
| Last Activity| ↕ clickable | Relative time (e.g. "54 minutes ago", "8:39 PM")                     |

**Row anatomy:**
- ~52 px row height
- Name column: first line bold client name; second line optional property/company in smaller gray text (e.g. "Zakkout real estate", "Diane property").
- Address: gray-white wrapping text.
- Status pill: `Lead` = small rounded pill with a blue dot and "Lead" text, background slight tint. `Active` = same with green dot and "Active" text.
- Last activity: right-aligned, gray-white text.
- Row hover: slight background lighten + cursor becomes pointer.
- Clicking anywhere on the row navigates to client detail page.

Observed rows (sample): Julie Hastings (Lead), Kathleen / Zakkout real estate (Lead), Diane Bergel / Diane property (Active), New Call [+13109845311] (Lead), Kitty Franklin (Active), Margie (Lead), Desiree (Lead)...

**Pagination**: at bottom (infinite scroll or standard pagination; observed as long list with no visible pager at top — likely infinite scroll or a "Load more").

### Bulk-select behavior
When the leftmost column checkbox is checked, a bulk-action toolbar presumably appears (not explicitly captured in this pass). Individual row checkboxes are present for bulk selection.

---

## 3. CLIENT DETAIL PAGE (`/clients/{id}`)

### URL example
`https://secure.getjobber.com/clients/130092973` — "Kitty Franklin"

### Overall layout
Two-column layout inside the main content area:

- **Left column (main, ~68% width)** — card-style client profile at the top, then work sections stacked below.
- **Right rail (~30% width, starts below header)** — Overview card, Last communication card, Notes card. Sticky while scrolling.

A thin horizontal **accent stripe** runs across the top of the client card indicating the client's status color (green stripe for Active, blue stripe for Lead).

### Profile card (top of main column)
Card bg `#1F252A`, rounded corners, ~24 px internal padding.

**Top row inside the card:**
- Left: small round circular avatar placeholder icon (generic silhouette) + small green "Active" status pill immediately to its right.
- Right: three action buttons in a row, right-aligned:
  1. **Email icon button** — envelope icon on a dark pill (`Email client` tooltip). Clicking triggers a mailto / compose dialog.
  2. **••• more-actions button** — three dots on a dark pill. Opens menu (Edit Client, Archive, Delete, etc.)
  3. **+ Create** — primary green button with plus icon. Opens a popover with sub-options (Quote, Job, Invoice, Request — client-scoped).

**Client name heading:** `Kitty Franklin` — ~42 px bold, left-aligned.
Next to the name, on the right, a small **pencil-edit icon button** to edit the name/info.

**Info grid (two columns):**

Left column, labeled rows:
- `Main phone`     : `8583364364`
- `Main email`     : `kittyf@san.rr.com` (green underlined link, mailto)
- `Payment terms`  : `Residential default (Net 30)`
- `Lead source`    : `—`
- `Tags`           : `None`
- `🟡 Quo`         : `Quo` — appears to be an integration tag for the Quo phone app. Yellow square icon with "Quo" text.
- `Call from Quo`  : has a small external-link icon button (opens Quo call log)

Right column:
- `Primary property` : `4040 Southview Drive, San Diego, California 92117` (underlined green link to property page)

### "Work overview" card (below profile card)
Card heading: **Work overview** (20 px bold). Plus (+) icon button in the card's top-right corner to add a new work item.

**Filter pill row beneath heading:**
- `Status | Active` (dark pill, currently selected)
- `📥 Requests`
- `🔍 Quotes`
- `🔨 Jobs`
- `💲 Invoices`
Each filter type pill shows the color-coded icon of that work type.

**Table inside the card:**
| Item                                     | Date                           | Status              | Amount      |
|------------------------------------------|--------------------------------|---------------------|-------------|
| 🔍 Quote #147 — Pool deck remodel        | Created at Feb 13, 2026        | 🟢 Approved pill    | $27,536.00  |
| 🔨 Job #108 — potential final day for…   | Scheduled for Apr 13, 2026     | 🔴 Late pill        | $0.00       |

Rows are clickable (go to quote or job detail).

### Info call-out rows (below Work overview)
Four full-width horizontal info-strips with left icon, center message, right green-underlined action:

1. `[👤 icon]  Add contacts to keep track of everyone you communicate with                    Add Contact`
2. `[🏠 icon]  Add properties so you can organize work by location                            Add Property`
3. `[💲 icon]  Bill this client to see billing history                                         Add Billing Information`
4. `[💳 icon]  Once a payment method is requested or added it can be used to automate…        Add or request`

Strip background: slightly lighter than card bg. ~56 px tall. Icon inside a rounded gray square on the left.

### "Client schedule" card
Heading `Client schedule` with `+` add button in top-right.

Filter row below heading (similar pills): `Type | A...` (Type filter).

Timeline list of scheduled items. Each row:
- Left: icon indicating type (calendar, reminder bell, truck-for-visit)
- Date + optional time, with secondary sub-label `Completed` when done (sub-label has an info-icon)
- Center: title + optional description (wrapping secondary text)
- Right: employee avatar chips (initials, e.g. `TRR`, `RW`, `DP`)
- Far right: status checkmark icon (indicates completed), or red-bell reminder icon for overdue reminders, or ••• menu
- An occasional 👍 thumbs-up icon appears next to a date (feedback marker)

Observed entries in the list:
- `Feb 28, 2026` — "This is your periodic reminder to invoice for job #84." — Unassigned (red/slashed avatar indicator)
- `Mar 06, 2026, 4:30 PM` — "Invoice for kitty" — TRR, checkmark
- `Mar 09, 2026, 7:25 AM` — "Restart kitties patio. Don't break anything else" — TRR, checkmark
- `Mar 23, 2026` — "Continue prepping the patio" — TRR, RW
- `Apr 10, 2026` (red bell) — "Reminder for Job #101 — Job was completed on Apr 10, 2026, but no invoice has bee…" — Unassigned
- `Apr 13, 2026, 7:00 AM` — "Visit for Job #108 - Kitty Franklin - potential final day for any touchups…" — TRR, RW
- `Apr 06, 2026, 9:00 AM` — "Visit for Job #101 - Kitty Franklin - finish up all the small details…" — RV, TC, DP — (completed row has slightly gray tint)
- etc.

Bottom of the card: **pagination arrows** — left (◀ disabled) and right (▶) rounded square buttons.

### "Recent pricing" card (bottom of main column)
Heading `Recent pricing` (20 px bold).

Table:
| Line item                   | Quoted                      | Job   |
|-----------------------------|-----------------------------|-------|
| Saw Cut Lines               | `$0.00` / `Feb 13, 2026`    | —     |
| Pool Deck Remodel           | `$20,710.00` / `Feb 13, 2026` | —   |
| Channel Drain Installation  | `$871.00` / `Apr 21, 2026`  | —     |
| Skimmer Replacement Credit  | `-$1,800.00` / `Apr 21, 2026` | —   |

Date appears below the price in a smaller gray font. The "Job" column has a subtle em-dash placeholder for each row.

### Right rail cards

**Overview card:**
- Heading `Overview` (18 px bold)
- Two stat rows stacked, each with big number + secondary-color label underneath:
  - `$0.00` — `Lifetime value`
  - `$0.00` — `Current balance`

**Last communication card:**
- Heading `Last communication` + chevron right (> links to a communications tab)
- Date: `Apr 10, 2026, 8:49 PM`
- Message preview: "Thank You: Your service visit by Rose Concrete and Development is complete"
- "Read more…" link in green at the bottom

**Notes card:**
- Heading `Notes` + `+` button to add a note
- Each note entry:
  - Author avatar chip (`TRR`) + author name in bold + date/time
  - Note text in white
  - Optional attached photos shown as a 4-across thumbnail grid with clickable `+ N` tile to show more
  - `Linked note` and `GPS` secondary links at the bottom of each note
  - Pencil edit icon in top-right of each note card
- Multiple notes stacked with dividers.

### Right-rail toggle
A "Hide panel" button exists (button ref_78) — presumably collapses the right rail into an icon on the edge.

---

## 4. NEW CLIENT FORM (`/clients/new`)

### URL
`https://secure.getjobber.com/clients/new`

### Layout
Page is a **two-column form**:
- **Left column (~35% width):** section heading + description text on the left side of each section (labels not fields).
- **Right column (~55% width):** the actual form fields for that section.

Each section is separated by a faint horizontal divider line.

Page title: `New Client` — 32 px bold at the top.

### Section: Primary contact details
*(Left-col description: "Provide the main point of contact to ensure smooth communication and reliable client records.")*

Fields in right column, stacked:
1. **Row:** three inputs side-by-side:
   - `Title` (small dropdown, ~140 px) — default value `No title`. Options likely include Mr, Mrs, Ms, Dr, etc.
   - `First name` (text input, ~275 px wide)
   - `Last name` (text input, ~275 px wide)
2. `Company name` (full-width text input)

### Sub-section: Communication
*(Bold label sitting above its fields, same column)*
- `Phone number` (full-width input)
- `Email` (full-width input)
- Green underlined link: `Communication settings` (takes user to notification prefs)

### Sub-section: Lead information
- `Lead source` (full-width input — appears to be combobox; lets you type or pick an existing lead source)

### Collapsible: Additional client details
Full-width dark rounded collapsible panel (expanded by default).

Header: `Additional client details` with chevron (▲ when open).

Content:
- Hint text: `Create custom fields to track additional details`
- Button: `Add Custom Field` — secondary outlined button

### Collapsible: Additional contacts
Dark rounded collapsible, collapsed by default (▼). Opens to let you add non-primary contacts with name/phone/email.

### Section: Property address
*(Left-col description: "Enter the primary service address, billing address, or any additional locations where services may take place.")*

Fields (right column):
- `Street 1` (full-width)
- `Street 2` (full-width)
- Row: `City` + `State` (50/50)
- Row: `ZIP code` + `Country` dropdown (placeholder `Select a country`)
- `No tax rate created` (full-width dropdown — pick or create a tax rate)
- Checkbox (green filled, checked by default): `Billing address is the same as property address`

Below: green outlined button **`Add Another Address`** (adds a new property block for a second property).

### Collapsible: Property details
`Property details` — collapsible (▼). Expands to let you set property-specific fields.

### Collapsible: Property contacts
`Property contacts` — collapsible (▼). Expands to add contacts attached to the property.

### Footer action bar (sticky at bottom of page)
Row spans full main content width, separated from form by whitespace (not a hard bar).
- Left: `Cancel` (secondary outlined, ~100 × 40 px)
- Right side, two buttons:
  - `Save and Create Another` (green outlined, ~200 × 40 px)
  - `Save client` (primary green filled, ~130 × 40 px)

### Styling notes
- All text inputs: dark background `#1F252A`, faint border, placeholder in gray. On focus: brighter border (green).
- Collapsible panel header bg slightly lighter than page. Chevron rotates 180° when expanded.
- Left-column section labels: 20 px bold white.
- Description text under labels: 13 px secondary gray.

---

## 5. QUOTES LIST (`/quotes`)

### URL
`https://secure.getjobber.com/quotes?order=ASCENDING&sort=QUOTE_STATUS`

### Page header
Same pattern as Clients:
- Left: `Quotes` 32 px bold heading.
- Right: **`New Quote`** (primary green), and `••• More Actions` (secondary outlined). More Actions opens menu with export options.

### KPI card strip (row of 4 metric cards + 1 promo)

1. **Overview** — different layout from other cards. Contains a mini-legend list:
   - 🔘 `Draft (15)` — gray bullet
   - 🟡 `Awaiting response (46)` — yellow bullet
   - 🔴 `Changes requested (0)` — red/orange bullet
   - 🟢 `Approved (31)` — green bullet
2. **Conversion rate** — sub-label `Past 30 days`. Info-tooltip (ⓘ) next to title. Big value `21%`. Green pill `↑ 75%`. View-report chevron (↗).
3. **Sent** — sub-label `Past 30 days`. Value `19`. Red pill `↓ 24%`. Secondary dollar `$178.8k`. Chevron.
4. **Converted** — sub-label `Past 30 days`. Value `4`. Green pill `↑ 33%`. Secondary dollar `$18.9k`. Chevron.
5. **Promo / AI tip card** (right-most, wider) — "Since July 16, 2025, ↑11% of your sent quotes were not seen by the potential customer. A higher view rate could help you win more work." Green underlined link: `Learn more with ✨ Jobber AI`.

### "All quotes" section
- Section heading: `All quotes` + `(175 results)` in gray.

**Filter toolbar row:**
- `Status | All` — pill dropdown. When clicked opens popover with search box and the following options (each with a color dot and a count):
  - All (checked)
  - 🔘 Draft (15)
  - 🟡 Awaiting response (46)
  - 🔴 Changes requested (0)
  - 🟢 Approved (31)
  - 🔵 Converted (20)
  - 🔘 Archived (63)
- `📅 All` — date-range pill with calendar icon. Opens a date-range picker.
- `Salesperson | All` — pill dropdown with team-member filter.
- Far right: `Search quotes...` text input.

### Quotes table
| ☐ checkbox | Client ↕ | Quote number ↕ | Property | Created ↕ | Status ↕ | Total |
|---|---|---|---|---|---|---|

**Row anatomy:**
- Client: bold client name.
- Quote number column: first line `#200` bold, second line title/description in gray (e.g., "Basic Driveway Demolition and Replacement").
- Property: full address with wrapping.
- Created: date (e.g. `Apr 21, 2026`).
- Status: colored pill (same set as the filter — Draft, Awaiting response, Changes requested, Approved, Converted, Archived) with a leading colored dot.
- Total: right-aligned dollar amount (e.g., `$52,052.89`).

Rows are clickable → open quote detail page (`/quotes/{id}`).

---

## 6. NEW QUOTE FORM (`/quotes/new`)

### URL
`https://secure.getjobber.com/quotes/new`

### Overall structure
Full-width single column, ~1230 px content wrapped inside the main area. No left-column label layout. Instead the form is a vertical stack of big cards, each with its own section heading.

A thin **magenta/pink stripe** runs across the top of the page header card — this is the Quote column color (consistent with the Quote KPI card on home).

Sticky **bottom action bar** is visible at all times as you scroll: `Cancel` | `Save Quote ▼` (green; split button with chevron for extra save options).

### Header card
- Small magnifier-over-page icon + heading `New Quote` (same as quote icon elsewhere, small magenta glyph).
- Full-width `Title` input (bold placeholder `Title`).
- Two-column split below:
  - **Left column:**
    - `Select a client` — client picker (opens searchable combobox of existing clients, or lets you create a new one from within the flow).
  - **Right column (meta fields):**
    - `Quote #` — auto-incremented number (e.g. `201`). Editable.
    - `Salesperson` — pill-style dropdown. Currently `Salesperson | Thomas Ronnie Rose`.
    - Small divider row showing a **DocuSign** logo + label `Docusign Integration` (integration status).
    - `Service Agreement with updated form Required` — toggle switch (currently green/YES). Label describes an auto-attach requirement.
    - `Customize` label with a green outlined button `Add field` — add custom fields to quote header.

### "Try Introduction" adder
Below the header card, before the first line item block, there's a pill button `+ Try Introduction` — adds a formatted introduction text block above line items.

### Product / Service card (line item block)
Heading `Product / Service` (20 px bold).

Line-item row (single row initially):
- `Name` — wide input (product/service name; autocomplete on typed strings matches saved products)
- `Quantity` — small numeric input, default `1`
- `Unit price` — currency input, default `$0.00`
- `Total` — currency input (computed: qty × price), default `$0.00`
- Below the row, a full-width `Description` multi-line textarea.

Row actions (appear on hover / via kebab): reorder drag handle, delete, duplicate.

Below the first line-item block, three action buttons side-by-side:
- **`+ Add Line Item`** (primary green filled pill) — adds a new line-item row
- **`Try Optional Line Items`** (secondary dark pill) — add selectable/optional items the client can pick
- **`Add Text`** (secondary dark pill) — inserts a free-text block between line items

### Totals panel (bottom of the line-items card)
Divided from line items by a horizontal separator.
Left side: eye-icon + label `Client view` + green underlined `Change` link — opens a preview / display-options popover.

Right side — stacked key/value rows, right-aligned values:
- `Subtotal`  ······················· `$0.00`
- `Discount`  ······················· **`Add Discount`** (green underlined link)
- `Tax`       ······················· **`Add Tax`** (green underlined link)
- `Total` (bold) ···················· `$0.00`

Below the totals, a link **`Add Deposit or Payment Schedule`** (green underlined).

### "Add more" pill strip (between main card and disclaimer)
A small pill strip with a plus icon and three buttons: `Try Attachments`, `Try Images`, `Client message` — each adds an optional block (file upload, image gallery, message to client).

### Contract / Disclaimer card
Heading `Contract / Disclaimer` + trash-can delete icon in top-right.
- Multi-line textarea pre-filled with: *"This quote is valid for the next 30 days, after which values may be subject to change."*
- Checkbox: `Apply to all future quotes` (saves the disclaimer as default).

### Notes card
Heading `Notes` (20 px bold).
- Empty-state: dashed-border box centered with an upload/compose icon and the placeholder `Leave an internal note for yourself or a team member`.
- Clicking the box opens an internal-only note editor (not visible to the client).

### Sticky footer actions
- `Cancel` — secondary outlined, left-most at right-end group
- `Save Quote` — primary green split-button with chevron. Clicking chevron reveals dropdown **"Save and..."**:
  - ✉ `Send as Email`
  - 💬 `Send as Text Message`
  - 🔨 `Convert to Job`
  - ✉📦 `Mark as Awaiting Response`

The dropdown uses small icons with two-line labels for some items.

---

## 7. QUOTE DETAIL (`/quotes/{id}`)

### URL example
`https://secure.getjobber.com/quotes/54532132` — "Pool deck remodel" for Kitty Franklin

### Page layout
Two-column: main card-stack on the left (~68%), right rail on the right (~30%).
A **magenta/pink stripe** runs across the top of the main card indicating Quote color.

### Header card
Top row inside the main header card:
- Left: small Quote icon (magnifier-over-page, magenta) + **status pill** (e.g. `🟢 Approved`). Pill reflects the quote's status; color maps to the status list.
- Right: two action buttons, right-aligned:
  - `••• More` — secondary outlined pill. Opens menu (see below).
  - `🔨 Convert to Job` — **primary green button**. Converts quote to job.
    - (Button label changes to `Send`, `Collect Signature`, etc. based on the quote status)

**Quote title:** `Pool deck remodel` (~42 px bold). A small **pencil edit icon** to the right of the title.

**Two-column info grid:**

Left column is an inset card-in-card with the client summary:
- `Kitty Franklin` (bold, with green-dot active indicator) + `•••` menu in the top-right of the client card
- `Property Address` label in gray
- `4040 Southview Drive, San Diego, California, 92117`
- Phone `8583364364`
- Email `kittyf@san.rr.com` (green underlined link)

Right column (no card, just labeled rows):
| Label | Value |
|---|---|
| Quote # | `147` |
| Salesperson | avatar chip `TRR` + `Thomas Ronnie Rose` |
| Created | `Feb 13, 2026` |
| Approved | `Feb 20, 2026` |
| Sent | `Feb 13, 2026` |
| Email opened | `Feb 22, 2026` |
| Viewed | `Feb 22, 2026` |
| (DocuSign integration row) | logo + `Docusign Integration` label |
| Service Agreement with updated form Required | `Yes` |
| Link | `View in Docusign ⧉` (external-link icon) |
| Status | `Draft` (or live status) |

### "More" menu contents (right-click on More button)
Popover sections, left-aligned, each with an icon:
- **Create Similar Quote** (duplicate icon)
- `Send as...` (section label)
  - ✉ Email
  - 📤 Send Text
- `Mark as...` (section label)
  - ✉ Awaiting Response
  - 🗄 Archive
- 👁 Preview as Client
- ✏ Collect Signature
- 🖨 Print or Save PDF
- 🗑 Delete (red label)

### Product / Service card
Heading `Product / Service` + **pencil edit icon** in top-right to edit the items.

Contents: stacked line-item rows, each row:
- **Left column:** product/service name (bold) + optional long multi-paragraph description in gray below.
- **Right column, three numeric sub-columns:** Qty, Unit price, Line total (right-aligned).

Example rows from this quote:
- `Pool Deck Remodel` — long description covering demolition, sub base, concrete install — Qty `1`, `$X`, line total
- `Drainage` — description — Qty `1`, `$2,500.00`, `$2,500.00`
- `Concrete Pump` — description — Qty `1`, `$650.00`, `$650.00`
- `Skimmer Replacement Credit` — description (negative line) — Qty `1`, `-$1,800.00`, `-$1,800.00`
- `Tile replacement` / `travertine tile replacement` — Qty `1`, `-$90.00`, `-$90.00`

Divider, then totals inside the same card:
- `Subtotal` `$27,536.00`
- `Total` **bold** `$27,536.00`

### Client message card
Heading `Client message` + pencil edit icon.
Paragraphs of the saved message, e.g.:
> Thank you for the opportunity to provide you with an estimate. We truly appreciate the chance to potentially work with you!
> If you have any questions or need clarification on anything, please don't hesitate to reach out…
> If you'd like to move forward with the project, just let us know and we'll get you on the schedule…

### Additional cards below (if present; observed on other quotes)
- **Contract / Disclaimer** — read-only rendering of the disclaimer.
- **Internal notes** — internal-only notes with author + time.
- **Attachments / Images** — files or photos with download links.
- **Signature block** — when signature is collected, shows signature image + signed-at timestamp.

### Right rail cards

**Deposit payment settings** card:
- Heading + pencil edit icon top-right.
- Three toggle rows:
  - `Card (Credit/Debit)` → `ON` (green pill toggle)
  - `Bank (ACH)` → `ON`
  - `Require payment method on file` → `ON`

**Notes** card (shared with Client): identical pattern to Client Notes — author chip, date, note text, thumbnails, +N, Linked note | GPS row, pencil-edit.

### Status flow (implied from screens)
Observed statuses in Status pill and the filter menu:
- Draft → Awaiting response → Approved → Converted
- Off-flow states: Changes requested, Archived

### Footer
No explicit footer buttons — actions live in the header (Convert to Job, More).

---

## 8. JOBS LIST (`/jobs`)

### URL
`https://secure.getjobber.com/jobs?order=ASCENDING&sort=JOB_STATUS`

### Page header
- Left: `Jobs` — 32 px bold
- Right: **`New Job`** (primary green), `••• More Actions` (secondary outlined).

### KPI card strip (4 cards, same pattern as Quotes)

1. **Overview** — legend:
   - 🔴 `Ending within 30 days (0)`
   - 🔴 `Late (26)`
   - 🟡 `Requires Invoicing (42)`
   - 🟡 `Action Required (12)`
   - 🟡 `Unscheduled (7)`
2. **Recent visits** — sub `Past 30 days`. Value `23`. Green pill `↑ 156%`. Secondary `$61.4k`. Chevron to report.
3. **Visits scheduled** — sub `Next 30 days`. Value `3`. Red pill `↓ 87%`. Secondary `$3,500`.
4. **Promo card** — "How can I get paid faster? Jobber can help you take payments instantly in person or set up automatic payments." Link `Learn more with ✨ Jobber AI`.

### "All jobs" section
Heading `All jobs` `(106 results)`.

**Filter toolbar:**
- `Status | All` — pill dropdown. Opens popover with:
  - All (checked)
  - 🔴 Ending within 30 days (0)
  - 🔴 Late (26)
  - 🟡 Requires Invoicing (42)
  - 🟡 Action Required (12)
  - 🟡 Unscheduled (7)
  - 🟢 Active (50)
  - 🟡 Today (1)
  - 🟢 Upcoming (4)
  - 🟡 On Hold (12)
  - 🔘 Archived (14)
- `Job Type | All` — pill dropdown (One-off job, Recurring job, etc.)
- Far right: `Search jobs...` text input.

### Jobs table
Columns (left to right):
| Client ↕ | Job number ↕ | Property | Schedule ↕ | Status ↕ | Total ↕ |

Row anatomy:
- Client column: bold client name.
- Job number column: first line `#13` bold, second line job title/description in gray (e.g. "Cleanup", "Dg and artificial turf installation", "Finalize details to prepare for pour", "Pour day").
- Property: full address, wrapping.
- Schedule: date (e.g. `July 21, 2025`).
- Status pill colored per status ( `🔴 Late`, `🟢 Active`, `🟡 Requires Invoicing`, etc.).
- Total: dollar amount, right-aligned.

Rows clickable → `/jobs/{id}`.

---

## 9. NEW JOB FORM (`/jobs/new`)

### URL
`https://secure.getjobber.com/jobs/new`

### Layout
Full-width stacked card layout, like New Quote but with a **green top stripe** on the page header card (Jobs column color).

### Header card
- Heading row: hammer icon (small green) + `New Job`.
- `Title` — full-width input.
- Two-column grid below:
  - **Left column:**
    - `Select a client` — client-picker combobox.
  - **Right column:**
    - `Job #` — numeric (auto-filled next number, editable, e.g. `117`).
    - `Salesperson` — dark pill with `Assign ⊕` (opens employee picker).
    - `Ask for a review` — `👍 Try Reviews for free` (dark pill promo/CTA).
    - `Customize` — `Add field` green outlined button.

### Job type card
Heading `Job type` with info icon (ⓘ) tooltip.
- Tab-style segmented control: `One-off` (selected, green outline) | `Recurring`
- When "Recurring" is selected, additional fields appear (frequency, end date, etc. — inferred).

### Schedule card
Heading `Schedule` (20 px bold).
- Right-top: `📅 Show Calendar` (dark pill toggle) — shows a mini-calendar for drag-scheduling.
- Row: `Total visits 1 | On Apr 21, 2026` (summary).
- Fields row:
  - `Start date` — input, default today (`Apr 21, 2026`). Dark bg.
  - `Start time` — time picker with clock icon.
  - `End time` — time picker with clock icon.
  - `Assign` — employee dropdown (chevron).
- Checkbox: `☐ Schedule later` (under Start date) — schedule will be set later.
- Checkbox: `☐ Anytime` (under Start time / End time) — no specific time.
- `Repeats` dropdown — default `Does not repeat`. Options: Does not repeat, Daily, Weekly, Monthly, etc.
- `Visit instructions` — multi-line textarea.
- Side panel-style info card on the right (within the schedule card): clipboard icon + heading `CAPTURE ON-SITE DETAILS` (caps). Body: "Attach custom-built checklists so that nothing gets missed." Green link: `Create a Checklist`.
- Below that, a dismissible info banner: "**A new name for job forms** — Job forms are now checklists, so you can use them for visits and assessments. Manage them in settings." Button: `View Checklists Settings ⧉`. Close × top-right.

### Billing card
Heading `Billing`.
- Checkbox (green, checked by default): `Remind me to invoice when I close the job`
- Divider
- Checkbox (unchecked): `Split into multiple invoices with a payment schedule` — when checked, opens a schedule builder (milestone billing).

### Product / Service card
Same pattern as New Quote's Product / Service:
- Line item row: `Name`, `Quantity` (default `1`), `Unit price` (`$0.00`), `Total` (`$0.00`), and a `•••` menu on the far right for row actions.
- `Description` multi-line textarea.
- `+ Add Line Item` green outlined button.
- Thin horizontal divider.
- `Total price` row — right-aligned `$0.00`.

### Notes card
Same as quote — empty-state dashed box with upload icon and "Leave an internal note for yourself or a team member".

### Sticky footer
- Left: nothing
- Right: `Cancel` | `Save Job ▼` (green split-button, dropdown adds "Save and Schedule Another Visit", etc.)

---

## 10. JOB DETAIL (`/jobs/{id}`)

### URL example
`https://secure.getjobber.com/jobs/140591460` — Kitty Franklin, Job #108

### Layout
Two-column (main + right rail). **Green top stripe** on the main header card (Jobs color).

### Header card
- Top-left: hammer icon + status pill (e.g. `🔴 Late`, `🟢 Active`, `🟡 Requires Invoicing`).
- Top-right: action buttons:
  - `••• More` — opens menu (Close Job, Archive, Mark Visit Complete, Duplicate, Delete, Print or Save PDF, Create Invoice, Convert to Recurring, etc.)
  - **Contextual primary button** — label depends on status:
    - `Show Late Visit` (when a visit is overdue) — green pill with visit icon
    - `Send Invoice`, `Mark Complete`, etc. in other states

- **Job title** (big, wrapping): `potential final day for any touchups like pouring the concrete for the driveway` (~36 px bold, wraps across 2 lines). Pencil edit icon top-right.

- **Two-column info:**

Left column inset client card (same component as Quote detail):
- `Kitty Franklin` + green active dot + `•••` menu
- `Property Address`: `4040 Southview Drive, San Diego, California, 92117`
- Phone, Email (green link)

Right column rows:
| Label | Value |
|---|---|
| Job # | `108` |
| Job type | `One-off job` |
| Started on | `Apr 13, 2026` |
| Ends on | `Apr 13, 2026` |
| Billing frequency | `Upon job completion` |
| Automatic payments | `No` |

### Job Profitability card (promo / feature-gated)
Heading `Job Profitability` with a small green badge `Get Access` (upsell indicator). Close × in top-right.

Content: left side shows stat placeholders in a skeleton state:
- `Profit Margin` `__ %`
- `Total Price $____` − `Line Items $____` − `Labour $____` − `Expenses $____` = `Profit $____`

Right side: small empty donut chart placeholder.

Bottom-left: `Try Job Profitability` button (dark pill).

### Product / Service card
Same as Quote's — line items with name, description, qty, unit price, total. Editable via pencil icon. Totals row at bottom.

### Time Tracking info strip
Single-line info strip: `[⏱ icon]  Time tracked to this job will show here    Add Time Entry` (green underlined action).

### Expenses card
Heading `Expenses`.
- Info strip: `[💲 icon]  Track all expenses for this job in one place    Add Expense`
- When expenses exist, a table replaces the empty-state strip with columns: Date, Vendor, Category, Reimbursable, Total.

### Scheduled visits card
Heading `Scheduled visits` + `Edit All Visits` button (top-right, dark pill).

Info row below heading, two-column:
- Left: `First visit` / `Apr 13, 2026`
- Right: `Checklists` / `—`

Filter toolbar:
- `Status | All` pill dropdown (same status set as jobs)
- `+` button (top-right) — add a new visit

Visits table:
| Date and time ↕ | Title and instructions | Status ↕ | Assigned |
|---|---|---|---|

Row example: `Apr 13, 2026 7:00 AM | Kitty Franklin - potential final day for any… | 🔴 Overdue | [TRR][RW] | ✓ and ✏ action icons on the right`

### Billing card
Heading `Billing` + `Edit Invoice Settings` button (top-right, dark pill).
- `Reminders` label (gray) + `When the job is marked closed` description.
- **Tabs inside the card:** `Invoicing` (active, green underline) | `Reminders`

Invoices sub-table (Invoicing tab):
| Invoice | Due date | Status | Subject | Total | Balance |
|---|---|---|---|---|---|

Row example: `Create (green button in place of invoice # when no invoice yet) | — | 🟣 Upcoming | For Services Rendered | $0.00 | $0.00`

Clicking `Create` in the Invoice column starts invoice creation flow.

### Right rail

**Notes card** — same component as Client/Quote Notes with author, date, text, photos, + pencil edit.

---

## 11. SCHEDULE (`/schedule`)

### URL
Month view: `/schedule/month/{YYYY}/{M}/{D}?...`
Week view: `/schedule/week/{YYYY}/{M}/{D}?...`
Day view: `/schedule/day/{YYYY}/{M}/{D}?...`

### Top toolbar (shared across views)
Row 1:
- **Current period label** with chevron: e.g. `April 2026 ▾` (click opens month/year jump). 24 px bold.
- `←` / `→` arrow buttons (navigate previous / next period).
- `Today` button (dark pill, quick-jump to today's date).
- **`Create`** — primary green pill button (creates new visit / job / quote directly on the calendar).
- Right side: **view toggle segmented control** — `Month` | `Week` | `Day`, one highlighted green (current view).
- Right of view toggle: two small icon buttons:
  - Calendar-style icon (toggle map view/on-off)
  - Man / person icon (team filter)
  - `••• More` pill — more view options (List view, Map view, Unscheduled panel toggle, etc.)
- Far-right: **`Explore the New Schedule`** button (dark pill with sparkle icon) — CTA for new schedule UI.

Row 2 (filter pills):
- `Type | All` — job type filter
- `Team | Andy Richardson, Darryl Perry, …` — team filter with comma-joined names
- `Status | All` — status filter

### Month view
- 5-column (or 7 when Sunday–Saturday) grid of day cells. Shown in this screenshot: Mon Tue Wed Thu Fri (weekdays only).
- Today's cell has the day number in a **blue filled circle** (e.g., `21` highlighted).
- Each day cell:
  - Day number top-left (large digit) + `N visits` tag to its right.
  - List of visit/reminder cards beneath, stacked.
- Each card:
  - `✓` green check icon indicates an "anytime" visit (no specific time) that's completed, or a scheduled visit with a checkmark status.
  - `[👤 avatar chip]` = assignee indicator
  - Time + title or "Reminder about quote #..." in reminder rows (rendered in a distinctive red bg for reminders).
  - Visits are color-coded by status (green = active/upcoming, red maroon = reminder/overdue, blue = billing reminders).
- Cells overflow = list is clipped.

### Week view
- 5 columns (Mon – Fri) across the top.
- Top row per day: `Mon 20` and a small `1 visit` pill chip showing count.
- Below the header, an **"Anytime" swim-lane** row at the top of the time grid — holds visits without a specific time. Rounded-corner cards, top-align.
- Time grid below: rows are hours (7 AM, 8 AM, … 6 PM). Each cell represents a day-hour slot.
- Visit cards render inside the time grid at the correct start row, spanning their duration:
  - Card has a colored left bar + colored fill:
    - **Dark green** for completed/confirmed
    - **Light gray / olive** for anytime / unassigned
    - **Dark red/maroon** for reminders
    - **Teal / gray-blue** for reminders not yet fired
  - Card content: employee avatar chips at the top (initials); client name + brief descriptor ("City Sidewalk in Front of Customers House"); time (e.g. `8:30 AM`).
  - Cards are drag-and-droppable to change time (standard calendar behavior).
  - A small badge with number (e.g. `3`) on a card indicates visit count on overlapping cards or employee count.

### Day view
- Columns are **employees** (including an `Unassigned` column on the far left).
- Each employee column has a header with avatar chip + name, and a `N visits` chip below.
- **Anytime swim-lane** row at the top, same as Week view.
- Time grid (7 AM–6+ PM) with visit cards drop-placed in the assignee column at the correct time.
- Visit cards colored the same way as Week view.
- Dragging a card across columns reassigns to another employee. Resizing the card edges changes duration.

### Filter/side components (inferred from URL params)
URL params include: `unscheduled=off`, `map=hidden`, `assignees=...` (multiple). So the schedule page has:
- A toggleable **Unscheduled panel** (right side, for un-timed jobs — drag out to schedule).
- A toggleable **Map view** (toggled via the calendar icon in toolbar).
- Multi-select assignee filter.

### New-visit creation
Clicking-and-dragging on an empty time slot opens a new-visit modal with prefilled time, or clicking `Create` (top toolbar) opens a modal to create a visit/job/quote/task.

---

## 12. INVOICES

### 12a. Invoices list (`/invoices`)

URL: `https://secure.getjobber.com/invoices?order=ASCENDING&sort=INVOICE_STATUS`

**Page header:** `Invoices` (32 px bold) + `New Invoice` (primary green) + `••• More Actions`.

**KPI strip (4 cards + 1 promo):**
1. **Overview** — legend: 🔴 `Past due (0) $0`, 🟡 `Sent but not due (0) $0`, ⚫ `Draft (2) $2,300` (right-aligned dollar per row).
2. **Issued** — sub `Past 30 days`. Value `0` + gray pill `0%`. Secondary `$0`. Chevron report.
3. **Average invoice** — sub `Past 30 days`. Value `$0` + gray pill `0%`.
4. **Invoice payment time** — sub `Last 30 days`. Empty dash values + chevron.
5. **Promo card** — "Stop chasing or missing payments" with BETA badge. "You have 1 client missing a card on file". Button `Request Cards on File` (dark pill) + card graphic.

**"All invoices" section** — `(3 results)` count.

**Filter toolbar:**
- `Status | All` pill dropdown (Draft, Sent, Awaiting payment, Paid, Past due, Bad debt, Archived — inferred)
- `📅 All` date-range pill
- Far right: `Search invoices...`

**Invoices table:**
| Client ↕ | Invoice number ↕ | Due date ↕ | Subject | Status ↕ | Total ↕ | Balance ↕ |
|---|---|---|---|---|---|---|

Row examples:
- Dylan Leslie | #1 | Net 30 | For Services Rendered | ⚫ Draft | $1,500.00 | $1,500.00
- Ilona Kadar | #3 | Net 30 | For Services Rendered | ⚫ Draft | $800.00 | $800.00
- Dylan Leslie | #2 | Sep 26, 2025 | For Services Rendered | 🟢 Paid | $1,500.00 | $1,500.00

Status pills (observed): `Draft` (gray dot), `Paid` (green dot). Inferred additional: Sent (yellow), Past due (red), Awaiting payment (yellow), Archived (gray).

### 12b. Invoice detail (`/invoices/{id}`)

URL example: `/invoices/131658206` (Dylan Leslie, Invoice #2)

**Layout:** Two-column (main + right rail). **Blue/cyan top stripe** on the main header card (Invoices column color).

**Header card:**
- Top-left: dollar-badge icon (blue) + status pill (e.g. `🟢 Paid`).
- Top-right:
  - `••• More` (opens menu: Create Similar, Send as Email, Send as Text, Mark as Sent/Paid, Record Payment, Archive, Delete, Preview as Client, Print or Save PDF).
  - Context action green button — e.g. `Re-open Invoice` (when Paid), `Send Invoice` (when Draft), `Record Payment` (when Sent).
- **Invoice subject title:** `For Services Rendered` (~42 px bold). Pencil edit icon.
- Two-column info:
  - **Left column** inset client card:
    - `Dylan Leslie` + green dot + `•••` menu.
    - `Billing Address`, full address.
    - `Property Address` (optionally marked `(Same as billing address)`).
    - Phone, email (green link).
  - **Right column:**
    | Label | Value |
    |---|---|
    | Invoice # | `2` |
    | Invoice for | `Job #28` (green underlined link) |
    | Issued | `Aug 27, 2025` |
    | Viewed in Client Hub | `Sep 26, 2025` |
    | Payment terms | `Residential default (Net 30)` |
    | Due date | `Sep 26, 2025` |
    | Paid | `Sep 29, 2025` |
    | Salesperson | avatar + name |

**Product / Service card:** Same component as Quote/Job — line items with name, description (multi-paragraph), qty, unit price, total. Columns headed `Line Item | Quantity | Unit Price | Total`.

**Totals panel** inside the Product/Service card at the bottom:
- `Subtotal` `$1,500.00`
- `Total` **bold** `$1,500.00`

Additional totals rows when applicable (not all visible): Discount, Tax, Payments (if recorded), `Balance due`.

### Right rail (Invoice detail)

**Online payment settings** card:
- Heading + pencil edit top-right.
- Toggle rows: `Card (Credit/Debit)` = `OFF`, `Bank (ACH)` = `OFF`, `Partial payments` = `OFF`. (Per-invoice override of the client's payment defaults.)

**Client view** card:
- Heading + pencil edit top-right.
- Toggle rows controlling what the client sees in the PDF/HTML:
  - `Quantities` ON
  - `Unit prices` ON
  - `Line item totals` ON
  - `Account balance` ON
  - `Late stamp (if overdue)` ON

**Notes** card — same empty-state dashed box with "Leave an internal note for yourself or a team member".

---

## 13. SETTINGS

### Access
The Settings area is opened via the **gear icon** in the top-right header. That gear opens a dropdown menu, and the menu contains the `Settings` link.

### Gear-icon dropdown menu (top-right header)
Appears anchored to the gear. Contents (top to bottom):
- **User identity block** — avatar chip `TRR` + name `Thomas Ronnie Rose` bold + email `ronnie@sandiegoconcrete.ai` in gray. Clicking it opens account/profile (inferred).
- Divider
- **Try More of Jobber, Free** — green text/link (upsell).
- **Settings** — opens `/accounts/edit` (the Settings landing page).
- **Account and Billing** — billing, subscription management.
- **Manage Team** — team member list.
- **Refer and Earn** — referral program.
- **Product Updates** — with red badge showing unread count (e.g. `40`). What's-new feed.
- **Light Mode 🌞** — theme toggle (current = Dark; toggle to Light).
- Divider
- **Log Out**

### Settings landing page (`/accounts/edit`)

URL: `https://secure.getjobber.com/accounts/edit` (title "Company settings")

### Layout
Three-zone layout:
- **Global sidebar** (same left nav as rest of app) — still visible.
- **Settings sub-sidebar** (left of main content) — contains settings nav grouped into sections with all-caps section labels.
- **Main content (right)** — the settings page itself. Header breadcrumb shows `Rose Concrete and Development > Company settings` in the top bar in gray/white.

### Settings sub-sidebar — complete nav tree

**Settings** (heading, 22 px bold at top)

#### BUSINESS MANAGEMENT (section label, all caps 12 px)
- **Company Settings** — currently active (green text). URL `/accounts/edit`
- **Business Profile**
- **Products & Services**
- **Custom Fields**
- **Jobber Payments**
- **Expense Tracking**
- **Automations**

#### TEAM ORGANIZATION
- **Manage Team**
- **Work Settings** — URL `/work_configuration/edit/organizer`
- **Schedule**
- **Route Optimization** — URL `/routes`
- **Job Forms** — URL `/job_forms`

#### CLIENT COMMUNICATION
- **Client Hub** — URL `/client_hub_settings/edit`
- **Emails & Text Messages** — URL `/communication_settings`
- **Requests and Bookings** — URL `/work_request_settings/edit`

#### CONNECTED APPS
- **QuickBooks Online Integration** — opens OAuth
- **Docusign Integration** — opens OAuth
- **Zapier** — opens marketplace entry
- **Rose Concrete OpenClaw** — custom/proprietary integration for this account
- **Quo** — voice/phone integration OAuth

Each nav item is left-aligned, ~14 px, plain text; currently active item is highlighted with bold green text, no background pill.

### Main content — Company Settings

Heading: `Company settings` (~32 px bold).

Info banner (dismissible): blue-tinted card "Optimize your Google Business profile to reach more potential clients." with `Learn More` dark pill button and `×` close.

#### Card: Company details
Form fields:
- `Company name` — default `Rose Concrete and Development`
- `Phone number` — default `(904)575-1958`
- `Website URL` — default `https://www.sandiegoconcrete.ai/`
- `Email address` — default `ronnie@sandiegoconcrete.ai`
- `Street 1`, `Street 2`, `City`, `State`, `Zip code` (responsive grid — City/State side-by-side, Zip/Country side-by-side)
- `Country` — large select dropdown (all countries alphabetically, Afghanistan → Zimbabwe)
- Checkbox: `Keep address private` (with description: "Your address won't appear on public directories such as Client Hub, your Jobber website or LLMs.")

#### Card: Business hours
Description: "Business hours set your default availability for online booking, team members, and request forms."

7-row table (one row per day):
| Day | Hours |
|---|---|
| Sunday | Closed |
| Monday | 9:00 AM – 5:00 PM |
| Tuesday | 9:00 AM – 5:00 PM |
| Wednesday | 9:00 AM – 5:00 PM |
| Thursday | 9:00 AM – 5:00 PM |
| Friday | 9:00 AM – 5:00 PM |
| Saturday | Closed |

Right side of heading row: green underlined `Edit` link — opens a modal to adjust times / mark days closed.

#### Toggle rows below Business hours
- `Show business hours` toggle (OFF) + description "Display your business hours on client hub."
- `Help clients find my business` toggle (ON, green) + description "Allow your public business information (like name, services, and contact details) to be used by automated systems that help clients find and compare local service providers. This is currently only available in the US."

#### Additional sections (inferred, appear below via scrolling)
- **Branding** / logo upload (typical Jobber settings)
- **Client notifications / reminders defaults**
- **Sales tax settings**
- **Payment terms**

### Other settings pages (reachable from sub-sidebar)

Full URLs observed or inferred:
- `/accounts/edit` — Company settings
- `/accounts/edit#business_profile` (tab) — Business profile
- `/products_and_services` — Product / service catalog
- `/custom_fields` — Custom field builder
- `/payments_settings` — Jobber Payments
- `/expense_tracking` — Expense tracking defaults
- `/automations` — Automations builder (triggers → actions)
- `/team` — Manage Team (member list + roles)
- `/work_configuration/edit/organizer` — Work Settings (line item defaults, required fields)
- `/schedule_settings` — Schedule options (default visit length, color rules)
- `/routes` — Route Optimization (geofences, service areas)
- `/job_forms` — Job Form / Checklist builder
- `/client_hub_settings/edit` — Client Hub branding & permissions
- `/communication_settings` — Email/SMS templates, sender defaults
- `/work_request_settings/edit` — Request & Booking form builder
- `/integrations/quickbooks-online` — QBO integration details
- `/integrations/docusign` — DocuSign integration details

Each sub-page follows the same pattern: heading at top, stacked cards each with a specific setting, and a right-aligned Edit/Save per card.

### Styling notes on Settings
- Left sub-sidebar background: same dark as app.
- All-caps section labels in settings nav: ~12 px, letter-spacing ~0.05em, `#6B7580` gray.
- Form inputs and cards use the same component styles as the New Client / New Quote pages.
- Info banners use a blue-tinted rounded bg (`#1A3B55`) with blue ℹ icon on the left and a close × on the right.

---

## APPENDIX — Shared/reusable UI components

### Status pills (observed across lists and detail pages)
Each pill: rounded-pill shape, ~24 px tall, 8–12 px horizontal padding, 12 px font, **leading colored dot (6 px)** followed by label text. Dark-tinted fill with accent-colored text/dot. Consistent color semantics:

| Color       | Hex (approx) | Meanings                                                 |
|-------------|--------------|----------------------------------------------------------|
| Green       | `#8FBF4A`    | Approved, Active, Paid, Upcoming                         |
| Yellow      | `#E8B74A`    | Awaiting, Requires Invoicing, Action Required, Unscheduled, On Hold |
| Red         | `#E0443C`    | Late, Overdue, Past Due, Ending Soon, Bad Debt           |
| Gray/white  | `#6B7580`    | Draft, Archived                                           |
| Blue        | `#4FA8E0`    | Converted, Upcoming payout, Info                         |
| Magenta     | `#D46B7E`    | Changes requested                                         |

### Avatar chip
- Circle, 28 px diameter
- Background: colored tint per-user or neutral gray (user initials shown in bold, 11 px).
- "TRR" = Thomas Ronnie Rose, "RW" = Roger Witthoeft, "DP" = Darryl Perry, "RV" = (assumed Ricky V), "TC" = (assumed).
- Used on appointment cards, schedule cards, person columns in day view, and in all "assigned" columns.

### Toggle switch
- Rounded pill, ~44 × 22 px.
- ON = green fill with a white circle on the right + green check mark (`ON` label next to the switch).
- OFF = dark fill with the circle on the left + × mark (`OFF` label).
- Label sits to the left of the switch.

### Primary green button
- Background `#B6DC6B` (lime-green)
- Text black, bold
- Radius ~6 px
- Height 40 px
- Hover: slightly darker green

### Secondary outlined button
- Transparent background, `#B6DC6B` 1 px border
- Text in green `#B6DC6B`
- Same height, same radius

### Tertiary / dark pill button
- Dark fill (`#2A323A`), white text, rounded pill, 32–40 px tall
- Used for filter dropdowns, view toggles, segmented controls

### Card pattern
- Background `#1F252A`
- 12 px radius
- Internal padding 24 px
- Card heading: 20 px bold
- Card actions (top-right): pencil edit icon, + add icon, × close, or a `•••` kebab menu

### Table pattern
- Transparent background, column headers in white 13 px with ↕ sort arrow where sortable.
- Rows separated by 1-px `#2A323A` dividers, height ~52 px.
- Hover: row background lightens subtly.
- Row click = navigate to detail page.

### Filter pill dropdown
- Pill shape with label + `|` divider + current value (e.g. `Status | All`).
- Click → popover with search box at top and list of options, each with a leading color dot.
- Checked option shows a right-aligned ✓.
- Escape / click-outside closes.

### Empty-state box
- Dashed 1 px border, 12 px radius
- Centered circular icon (48 px circle bg)
- Placeholder text below the icon
- Used in Notes sections across Client, Quote, Job, Invoice detail pages.

### Global Create popover
Horizontal strip of 5 tiles: Client, Request, Quote, Job, Invoice, each a gold/amber icon above a small white label.

### Breadcrumb (settings pages)
Top of page inside the header bar. Format: `Account Name > Page Title` separated by ` > ` with mid-gray slash lines.

---

## STATE / URL PATTERNS OBSERVED
- List routes accept `status` query param filters (e.g., `/quotes?status=approved`, `/jobs?status=active`, `/invoices?status=awaiting_payment`).
- Detail routes follow `/{resource}/{id}`. Quotes use `/quotes/{id}`, Jobs use `/jobs/{id}` (with some deep links in `/work_orders/{id}`), Invoices `/invoices/{id}`, Clients `/clients/{id}`.
- Property pages live under `/clients/{client_id}/properties/{property_id}`.
- Schedule URL includes view (month/week/day), date (/YYYY/M/D), and several filter params: `unscheduled`, `map`, `assignees` (multi), `status`, `type`.
- Sort params: `order=ASCENDING|DESCENDING`, `sort=UPDATED_AT|QUOTE_STATUS|JOB_STATUS|INVOICE_STATUS|...`.

---

## END OF AUDIT


