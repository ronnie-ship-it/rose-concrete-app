# Rose Concrete Crew App — Phase 2 Foundation Brief

**Date:** 2026-04-29
**Repo:** `ronnie-ship-it/rose-concrete-app`
**Scope:** establish the foundation Phase 3 will build on — design tokens, navigation discipline, terminology, and a path to kill the hydration errors. No screen redesigns here; that's Phase 3.

> **Approach note.** Match Jobber's *structural* patterns (left-rail/bottom-nav layout, list→detail flow, status pill conventions, create speed-dial idea, stable mobile chrome). Do not match Jobber's distinctive visual treatments (their accent palette, illustrations, brand mark). Rose Concrete's app should look like Rose Concrete — anchored to the website at sandiegoconcrete.ai.

---

## 1. Design tokens

### Source of truth
sandiegoconcrete.ai exposes brand variables on `:root`:
- `--brand: #1b2a4a` (deep navy)
- `--accent: #2abfbf` (teal)
- `--cream: #f5efe0` (warm cream)

Body uses `rgb(250, 250, 250)` BG with `rgb(23, 23, 23)` text and `system-ui, sans-serif`.

The crew app should consume the same identity. Tokens below extend the website palette into a full app system without inventing a new look.

### Color tokens

```css
:root {
  /* === Brand (from sandiegoconcrete.ai) === */
  --brand-900: #1b2a4a;        /* deep navy — primary text on light, primary surfaces dark */
  --brand-700: #2c3f63;        /* hover/elevated navy */
  --brand-500: #4a5d80;        /* muted navy / disabled-on-brand */

  --accent-600: #1f9b9b;       /* pressed accent */
  --accent-500: #2abfbf;       /* default accent — teal CTAs, links, focus */
  --accent-400: #5fd4d4;       /* hover accent */
  --accent-100: #e3f6f6;       /* accent surface (badge bg, info card) */

  --cream-100: #faf6ec;        /* lightest cream — surfaces */
  --cream-300: #f5efe0;        /* default cream — page bg accent */
  --cream-500: #ebe2cc;        /* warm divider */

  /* === Neutrals === */
  --bg:        #fafafa;        /* page bg */
  --surface:   #ffffff;        /* card bg */
  --surface-2: #f4f5f7;        /* subtle elevation, list rows */
  --border:    #e5e7eb;        /* hairline */
  --border-strong: #cbd1d8;
  --text:      #171717;
  --text-muted:#5a6371;
  --text-dim:  #8b95a3;
  --text-on-brand: #ffffff;
  --text-on-accent:#ffffff;

  /* === Status (functional) === */
  --status-success: #15803d;
  --status-success-bg: #dcfce7;
  --status-warn:    #b45309;
  --status-warn-bg: #fef3c7;
  --status-danger:  #b91c1c;
  --status-danger-bg:#fee2e2;
  --status-info:    var(--accent-500);
  --status-info-bg: var(--accent-100);

  /* === Entity status pills === */
  --pill-draft-bg:    #e5e7eb; --pill-draft-fg:    #374151;
  --pill-sent-bg:     var(--accent-100); --pill-sent-fg:     var(--accent-600);
  --pill-approved-bg: #dcfce7; --pill-approved-fg: #15803d;
  --pill-rejected-bg: var(--status-danger-bg); --pill-rejected-fg: var(--status-danger);
  --pill-overdue-bg:  #fde2e2; --pill-overdue-fg:  #991b1b;

  /* === Radii === */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-pill: 9999px;

  /* === Shadow === */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.12);
}
```

### Typography

The site uses `system-ui` and lets the OS pick. That's good for mobile (native look on iOS and Android). Keep that.

```css
:root {
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-display: var(--font-sans);  /* same family, heavier weight */
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --fw-regular: 400;
  --fw-medium:  500;
  --fw-semibold:600;
  --fw-bold:    700;
  --fw-black:   900;     /* for the big hero/headline weight used on the marketing site */

  /* Mobile-first scale */
  --fs-xs:  12px;
  --fs-sm:  13px;
  --fs-md:  15px;        /* base body */
  --fs-lg:  17px;
  --fs-xl:  20px;
  --fs-2xl: 24px;
  --fs-3xl: 30px;        /* screen titles */
  --fs-4xl: 36px;        /* hero numbers (e.g. timesheet total) */
}
```

Headline rule: screen titles and large numbers use `--fw-black` to echo the marketing site's hero treatment. Buttons and labels use `--fw-semibold`. Body is `--fw-regular`.

### Spacing & sizing

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;       /* default screen padding */
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10:40px;

  /* Touch targets (per Apple HIG / Material) */
  --touch-min: 44px;     /* never make a tappable target smaller */

  /* App chrome */
  --header-h: 56px;
  --bottomnav-h: 64px;
  --safe-bottom: env(safe-area-inset-bottom);
}
```

### Component primitives — quick rules

- **Card.** `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4);`
- **List row.** `min-height: var(--touch-min); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border);` last row no border.
- **Primary button.** `background: var(--brand-900); color: var(--text-on-brand); height: 48px; border-radius: var(--radius-md); font-weight: var(--fw-semibold);` Pressed → `--brand-700`. (This matches the dark "Call (619) 537-9408" CTA on the marketing site.)
- **Accent button.** `background: var(--accent-500); color: var(--text-on-accent);` for affirmative or AI/quick actions (matches the teal phone-pill in the site nav).
- **Ghost button.** `background: transparent; color: var(--brand-900); border: 1px solid var(--border-strong);`
- **Status pill.** `display: inline-flex; padding: 2px 8px; border-radius: var(--radius-pill); font-size: var(--fs-xs); font-weight: var(--fw-semibold);` Use the `--pill-*` token pair.
- **FAB (Create speed-dial).** Circle, `--accent-500`, 56×56, bottom-right inside content with `--bottomnav-h` margin. White plus icon.

### Where to put the tokens in the codebase

- New file `app/styles/tokens.css` (or `styles/tokens.css`) — defines the `:root` block above.
- Imported once in `app/layout.tsx` (or root layout).
- If the project uses Tailwind, mirror these as theme extensions in `tailwind.config.ts`:
  ```ts
  theme: {
    extend: {
      colors: {
        brand: { 900: '#1b2a4a', 700: '#2c3f63', 500: '#4a5d80' },
        accent:{ 600: '#1f9b9b', 500: '#2abfbf', 400: '#5fd4d4', 100: '#e3f6f6' },
        cream: { 100: '#faf6ec', 300: '#f5efe0', 500: '#ebe2cc' },
      },
      fontFamily: { sans: ['system-ui', 'sans-serif'] },
      borderRadius: { md: '10px', lg: '16px' },
    }
  }
  ```

### Acceptance criteria
- A consumer of `var(--brand-900)`, `var(--accent-500)`, etc. anywhere in the codebase replaces every hardcoded hex.
- No remaining `#XXXXXX` literals in the crew components after Phase 2 (lint rule recommended).
- Light mode is the only mode supported in Phase 2. Dark mode is Phase 5+ work.

---

## 2. Navigation discipline — kill every dashboard leak

The audit found that nearly every "to do" row, every More-menu item, and several detail screens link from `/crew/...` into `/dashboard/...`, with no return path. A field worker tapping "14 require invoicing jobs" is dropped into the desktop admin app.

### Inventory of leaks (from the audit)

| Source page | Link label | Current href | Replace with |
|---|---|---|---|
| `/crew` Home | "0 new requests" | `/dashboard/requests?status=new` | `/crew/requests?status=new` |
| `/crew` Home | "0 assessments completed" | `/dashboard/requests?status=qualified` | `/crew/requests?status=qualified` |
| `/crew` Home | "0 approved quotes" | `/dashboard/quotes?status=accepted` | `/crew/quotes?status=accepted` |
| `/crew` Home | "0 action required jobs" | `/dashboard/projects?status=scheduled` | `/crew/jobs?status=scheduled` (and rename `projects` → `jobs`, see §3) |
| `/crew` Home | "14 require invoicing jobs" | `/dashboard/projects?status=done` | `/crew/jobs?status=done` |
| `/crew` Home | Business health "View all" | `/dashboard/reports` | **Remove** — admin metric, not crew-relevant |
| `/crew/more` | Apps & integrations | `/dashboard/settings/integrations` | **Remove** from crew More |
| `/crew/more` | Marketing | `/dashboard/settings/reviews` | **Remove** from crew More |
| `/crew/more` | Subscription | `/dashboard/settings/workspace` | **Remove** from crew More |
| `/crew/more` | Product updates | `/dashboard/activity` | `/crew/notifications` (consolidate) |
| `/crew/more` | About | `/dashboard/settings` | `/crew/about` (new — version, EULA) |
| `/crew/more` | Profile | `/dashboard/settings/team` | `/crew/profile` (new — current user) |
| `/crew/more` | Manage team | `/dashboard/settings/team` | **Remove** from crew More (admin) |
| `/crew/more` | Company details | `/dashboard/settings/business-profile` | **Remove** from crew More (admin) |
| `/crew/more` | Refer a friend | `mailto:refer@...` | **Remove** from crew More until a real referral program exists |
| `/crew/more` | Support | `mailto:support@...` | `/crew/support` (new — FAQ + contact form) |
| `/crew/schedule` map | "View all" | `https://google.com/maps` | `/crew/schedule/map` (in-app) |

### Behavioral rule
**Inside `/crew/*`, never push to `/dashboard/*`.** If a destination doesn't exist on the crew side, build a stub screen with "This is a desktop-only feature — open on the desktop app" *and a link the crew can text to themselves*, rather than a hard redirect that strands them.

### Implementation steps
1. **Add a lint rule** (or PR-time grep) that fails if any file in `app/crew/**` references `/dashboard`. This is a one-line check:
   ```bash
   grep -rE "(href|to)=[\"']/dashboard" app/crew && exit 1 || exit 0
   ```
   Wire as a pre-commit hook or CI step.
2. **Crew More menu rewrite** — final menu after Phase 2:
   - Notifications (replaces Product updates)
   - Support
   - Profile
   - About
   - Sign out
3. **Crew dashboard "to do" rows** — point to `/crew/*` filtered list views. If any of those views don't yet exist as crew-side routes, scaffold them in this PR (simple Supabase query + list — they get prettier in Phase 3).
4. **Schedule map** — wrap the map in `/crew/schedule/map`. The "View all" link opens the in-app full-screen map view, not Google Maps. The expanded view can include a "Open in Maps" footer button as an explicit user choice.

### Acceptance criteria
- Grep confirms zero `/dashboard` references inside `app/crew/**`.
- Tapping anything from `/crew/*` lands the user on a `/crew/*` URL or an explicit external link the user chose.
- Lint/grep runs in CI.

---

## 3. Terminology dictionary

The audit flagged inconsistent vocabulary across screens. Pick one term per concept and rename routes, copy, and DB references in this Phase 2 PR. Adopt Jobber's terminology where it's the dominant convention in the trade — that lowers training cost when crew transition between tools.

| Concept | Used in your app today | **Canonical term (going forward)** | Notes |
|---|---|---|---|
| Customer record | Client | **Client** | Keep. |
| Sales opportunity / inbound inquiry | Request, Lead | **Request** | "Lead" appears once; remove. Inbound from website + phone = Request. |
| Priced proposal | Quote, Estimate | **Quote** | Keep. |
| Scheduled work | Job, Project | **Job** | Rename URL `/crew/projects/[id]` → `/crew/jobs/[id]`. Update any DB column / type alias if needed. |
| Calendar appointment within a job | Visit, Schedule entry | **Visit** | A Job has 1+ Visits. Schedule shows Visits. |
| Time entry | Time entry, Timesheet entry | **Time entry** | Keep. Timesheet = the weekly view of entries. |
| Field worker | Crew, Team member, User | **Crew member** | "Team" stays as a noun for a group of crew members. |
| Status indicator | Status pill, Tag | **Status pill** | Use a single component. |

### Migration steps
1. Rename `/crew/projects/[id]` → `/crew/jobs/[id]` (Next.js redirect from old to new for any bookmark in the wild).
2. Add a thin DB view if columns are named `project_*` so you don't need a destructive migration in this PR:
   ```sql
   create view jobs as select * from projects;
   -- and migrate writes incrementally
   ```
3. Update copy across forms, buttons, and toasts in one sweep. A glossary lives at `lib/copy/glossary.ts`:
   ```ts
   export const COPY = {
     job: { singular: 'Job', plural: 'Jobs' },
     visit: { singular: 'Visit', plural: 'Visits' },
     // ...
   };
   ```
   Components reference `COPY.job.singular` instead of hardcoding strings — makes future renames cheap.

### Acceptance criteria
- Every user-facing string in `app/crew/**` reads off `COPY` (no inline label drift).
- No remaining `Project` strings in the crew namespace.
- Old `/crew/projects/[id]` URLs 301 to `/crew/jobs/[id]`.

---

## 4. Hydration error root-cause checklist (React #418 + null `parentNode`)

The audit caught `Minified React error #418` (server/client HTML mismatch) firing on every page navigation, plus a `TypeError: Cannot read properties of null (reading 'parentNode')` that froze the renderer twice.

### Most likely sources

1. **Date rendering.** Phase 1's PR-A should resolve the most common variant — server renders `Apr 27` (UTC), client renders `Apr 26` (PT). Land PR-A first, then re-test before debugging anything else.
2. **`Date.now()` / `new Date()` directly in JSX** without using `suppressHydrationWarning` and without an effect. Grep:
   ```bash
   grep -rn "new Date()" app/crew components/crew lib | grep -v "test"
   ```
   Each hit either: (a) needs a stable seed passed from server props, or (b) needs to defer to client only via `useEffect` + `useState`.
3. **Conditional rendering on `window`/`navigator`** (e.g. "is iOS", "Contact Picker available"). The Client form's "Add from Contacts" disabled message reads off `navigator.contacts` — that's only defined client-side. Server renders one branch, client renders another. Fix with:
   ```tsx
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return null;  // or a stable skeleton
   ```
4. **Random IDs/keys.** `Math.random()` or `crypto.randomUUID()` in a render path will mismatch every time. Grep and replace with `useId()` or a server-stable id.
5. **Locale-formatted numbers / phones.** `Intl.NumberFormat` defaults to the server locale on the server and the user's locale on the client. Pin to `en-US`.
6. **Portals/modals** rendering before hydration completes — likely source of the `parentNode` null. Wrap modal mount with the same `mounted` guard.

### Debug steps (in order)
1. Land PR-A (timezone fix). Re-run the `/crew` flow on a real device with the Sentry/Vercel logs open. Most #418 noise should drop.
2. Search `app/crew/**` for: `new Date(`, `Date.now`, `Math.random`, `navigator.`, `window.`. Audit each hit.
3. Add `next.config.js` setting:
   ```js
   reactStrictMode: true,
   experimental: { swcTraceProfiling: true }
   ```
   And run `next build` — Strict Mode surfaces hydration mismatches in dev.
4. For any remaining mismatch you can't fix at the source, mark the offending element `suppressHydrationWarning` *only after* documenting why in a code comment. This is a band-aid, not a fix.

### Acceptance criteria
- Production console (Sentry/browser logs) shows zero new occurrences of React #418 over a 24-hour soak after Phase 2 ships.
- The `parentNode` null trace does not reproduce in a 10-tap navigation walkthrough on iOS Safari and Android Chrome.

---

## 5. PR plan for Phase 2

| PR | Subject | Rough size |
|----|---------|------------|
| PR-G | Tokens: introduce `tokens.css` and Tailwind theme; replace hardcoded hex in shared layout components only | small |
| PR-H | Token rollout to crew components: every `/crew/**` component reads tokens (incremental, can split if large) | medium |
| PR-I | Nav discipline: lint/grep CI rule + replace every `/dashboard` link in `/crew/**` | medium |
| PR-J | Crew More menu rewrite + new `/crew/notifications`, `/crew/profile`, `/crew/about`, `/crew/support` stubs | medium |
| PR-K | Terminology pass: `Project → Job` rename + glossary file + 301 redirects | medium |
| PR-L | Hydration error pass: audit `new Date`, `window`, `Math.random` in crew tree; fix or guard each | small-medium |

PRs G–L are largely independent and can be parallelized. Recommend landing G → H → I → K in that order; J and L slot in anywhere.

---

## Definition of done for Phase 2

1. Every color/font/spacing in `app/crew/**` is sourced from `tokens.css`.
2. CI fails any PR that introduces a `/dashboard` link inside `app/crew/**`.
3. Crew More menu has only crew-relevant items; admin items live exclusively at `/dashboard/*`.
4. `Project` is gone from the crew namespace; URLs and copy say `Job` and `Visit` consistently.
5. React #418 errors stop appearing in production logs for 24 hours straight.

When all five hold, move to Phase 3 (screen-by-screen specs).
