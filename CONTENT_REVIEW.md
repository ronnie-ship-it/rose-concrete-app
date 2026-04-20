# Content Review — items for Ronnie before launch

Everything here is a placeholder Claude wrote during the overnight build session.
Most of it is functional and shippable, but should be replaced with real data
before you point any Google Ads spend at the marketing site.

Sorted by priority — top items move the most needles for conversion + trust.

---

## 🔴 P0 — Replace before any paid traffic

### Customer reviews
**File:** `lib/marketing/reviews.ts`
**What:** Six placeholder Google reviews flagged with `placeholder: true`.
The `<SocialProof />` component renders them on the home page, every
service page, every landing page, and every service-area page — so a
visitor sees reviews on *every* path through the site.

**Action:** Pull six real Google reviews from the Rose Concrete and
Development listing. Replace each entry's `quote`, `author`,
`neighborhood`, `monthYear`. Delete the `placeholder: true` flag from
each (the component renders an amber dev badge on placeholders so
unreplaced ones can't ship to prod by accident).

Spread across services (driveway, patio, sidewalk, decorative, pool deck,
RV pad) and neighborhoods so each surface shows relevant social proof.

---

### Recent project photos + descriptions
**File:** `lib/marketing/projects.ts`
**What:** Six placeholder project entries flagged with `placeholder: true`.
Each renders as a gradient `<ImageSlot>` card via `<RecentProjects />` on
the home page and service pages.

**Action:**
1. Pick six recent jobs with photos you like.
2. Save each photo to `/public/marketing/projects/<filename>.jpg`,
   matching the `imageSlot` filename in the entry (or rename the slot).
3. Update `description` with one true sentence about each job.
4. In `components/marketing/recent-projects.tsx`, swap the `<ImageSlot>`
   element for `<Image src={"/marketing/projects/" + p.imageSlot}
   alt={p.title} ... />` — one-line edit.
5. Delete `placeholder: true` flag from each.

---

### Hero image slots (every page)
**Where:** Every marketing page renders a default `<ImageSlot>` for the
hero. Filename hint shown on the slot itself.

**Action:** When you have hero photos:
1. Save to `/public/marketing/heroes/<filename>.jpg`
2. In each page (or just edit `components/marketing/page-hero.tsx`),
   pass `imageSlot={"heroes/" + filename}` to render the photo via the
   ImageSlot. The form on the right column is the default and stays —
   the photo only renders when you explicitly opt-in via `rightColumn`.

---

### Safe Sidewalks Program project count
**File:** `lib/marketing/landing-pages.ts`
**Line:** Search for `// PLACEHOLDER STAT — REPLACE WITH REAL NUMBER`
**What:** The flagship Safe Sidewalks page's eligibility callout currently
reads *"We've handled dozens of Safe Sidewalks Program projects across
San Diego County."* This is a placeholder.

**Action:** Replace `dozens` with the real number (e.g. `47`,
`over 100`, `since 2024`). If you haven't done one yet, change the
sentence to something true like *"Our crew has handled City of San Diego
sidewalk repair to program spec — same standards apply whether you're
in the program or paying privately."*

---

## 🟡 P1 — Replace before week-2 review

### Service-area local context
**File:** `lib/marketing/service-areas.ts`
**What:** I wrote 12 cities of "what's typical for concrete in this
neighborhood" copy based on general San Diego knowledge. Most of it is
right, but read it for accuracy — especially:

- **Bonita** — "Sweetwater Valley equestrian community" — right vibe?
- **Clairemont** — "1950s-1960s planned community" — confirm era
- **Solana Beach** — "coastal salt-air rebar concerns" — accurate or
  marketing fluff?
- **Coronado** — "high water table" — true?
- **National City** — "1940s-1970s housing stock" — confirm

Each city is one Edit away from being right. Open the file, search for
the city name, fix the `localContext` string.

---

### Decorative Concrete service
**File:** `lib/marketing/services.ts`
**What:** I added a `decorative_concrete` enum value via migration 029
and wired the Decorative Concrete service page to pre-fill the lead
form with it. This will work once you run migration 029. Until then,
form submissions on `/services/decorative-concrete` will fail validation
because the DB doesn't yet have that enum value.

**Action:** Run `migrations/029_jobber_sync_status.sql` in Supabase SQL
editor. (Same migration also adds the Jobber-sync columns to clients.)

---

### Cost ranges
**File:** `lib/marketing/services.ts` and `lib/marketing/landing-pages.ts`
**What:** Every service and every landing page has a `typicalCost`
block with $ ranges. I picked numbers based on general San Diego market
research, but they should reflect *your* actual pricing.

**Action:** Open both files, scan the `typicalCost.rangeSentence` and
`typicalCost.exampleSentence` on each. Adjust to match what you'd
actually quote. The factors lists are content-shape-correct and don't
need rewriting.

---

## 🟢 P2 — Improve when you have time

### Expand FAQs on lower-traffic landing pages
**File:** `lib/marketing/landing-pages.ts`
**What:** Safe Sidewalks (16), Driveway Replacement (9), Pool Decks (9),
Stamped Patios (9), Sidewalk Repair (9) all have 8+ FAQs.
**Driveway Extensions (5), Driveway Aprons (5), RV Pads (5), Commercial
Flatwork (5), Drainage (5)** are at the minimum. They work fine as-is,
but adding FAQs to 8-10 each would expand the FAQPage rich-result
real estate in Google.

---

### Real Open Graph image asset
**File:** `app/opengraph-image.tsx`
**What:** Programmatic OG image — generates a 1200×630 navy gradient
+ brand text + phone at request time. Works today, looks fine.
**Optional improvement:** drop a real photo OG at `public/og-default.png`
to override per-page. Ronnie taking a great driveway photo and overlaying
the brand text would be more compelling than the programmatic version.

---

### Real verified email "from" address
**File:** `.env.local` (and Vercel env vars)
**What:** `RESEND_FROM_EMAIL=Rose Concrete <onboarding@resend.dev>` is
the Resend-default sandbox sender. Works for testing but emails will
land in spam for many providers.
**Action:** Verify `sandiegoconcrete.ai` in Resend (DNS records: SPF +
DKIM + return-path). Then set `RESEND_FROM_EMAIL=Rose Concrete
<leads@sandiegoconcrete.ai>`. Lead notification emails will then ship
with proper sender authentication.

---

### Google Tag Manager container
**File:** `.env.local`
**What:** `NEXT_PUBLIC_GTM_ID` is unset. The GTM script doesn't load
without it (safe default — no production tags fire in dev).
**Action:** Create a GTM container at `tagmanager.google.com`, drop the
`GTM-XXXXXXX` ID into env. The site already fires three custom events
(`lead_submitted`, `phone_click`, `sms_click`) via dataLayer pushes —
configure the GA4 tag in GTM to forward them.

---

### Call tracking provider
**File:** `.env.local` + provider account
**What:** `CALL_TRACKING_WEBHOOK_SECRET` is unset; `/api/calls/inbound`
returns 503 until configured. The schema + endpoint are wired so when
you pick a provider (CallRail, OpenPhone webhook, etc.), it's a small
follow-up to map their payload to our `CallEvent` shape.

---

### Google review QR code (future feature, not blocking)
**Where it'd live:** business cards, jobsite signs, invoice footers,
quote PDFs — anywhere a printed surface needs a "leave us a review"
shortcut a customer can scan with their phone camera.

**What's already done:** The canonical destination URL is wired in
`lib/marketing/brand.ts` as `GOOGLE_REVIEW_URL` (sourced from the GBP
"Get more reviews" panel). Footer + contact page already link to it.
Schema.org JSON-LD references it via `sameAs`.

**What's not done:** generating + embedding the QR image. Two paths:

1. **Static asset** — Ronnie downloads the QR PNG from the GBP "Get more
   reviews" panel, drops it at `public/marketing/google-review-qr.png`,
   and we render it via `<Image>` on print-targeted surfaces.
2. **Programmatic** — same approach as `app/opengraph-image.tsx`: an
   `app/qr-google-review/route.tsx` that uses `qrcode` (would be the
   first new npm dep on the marketing side) to generate the QR from
   `GOOGLE_REVIEW_URL` at request time. Renders crisp at any size.
   Print surfaces (invoices, quotes) reference it as
   `/qr-google-review.png`.

**Recommended:** option 1 for now — static asset is faster, no new
dependency, and the GBP-issued QR has Google's logo overlay built in
which converts better than a plain QR. Programmatic is the upgrade
path if/when we want to generate per-customer review-request QRs that
encode tracking parameters.

---

### Review Gate (4-5 star redirect) — not built yet
**Where it'd live:** a public page like `/review` (or post-job email
landing) that asks the customer to rate 1-5 stars first. 4-5 → forward
to `GOOGLE_REVIEW_URL`. 1-3 → present a private feedback form that
emails Ronnie directly, so we catch unhappy customers before a public
1-star hits Google.

**What's already done:** `GOOGLE_REVIEW_URL` constant is the redirect
target. The `/api/cron/review-requests` cron sends post-job review
asks 3 days after a milestone is paid. Today those go straight to the
Google URL — there's no gate in the middle.

**What's not done:** the gate itself. New page at `app/(marketing)/review/page.tsx`
(or under a token-protected `/review/[token]` if we want to attribute
each review request to a specific customer). Star-rating client
component, server action that branches on the rating. The post-job
email and review-request cron would then point at this gate URL
instead of straight at Google.

**Risk:** Google's review policy explicitly prohibits "review gating"
that *prevents* low-rated customers from leaving public reviews. The
implementation has to *invite* low-rated customers to private feedback
without blocking the Google route — i.e., always show the public link,
just lead with the private channel for low ratings. Worth a quick
read of Google's current policy before building.

---

## 🔵 Migrations to run before launch

In the Supabase SQL editor, in this order:

1. `migrations/028_service_type_marketing_expansion.sql` — adds 7 service
   type enum values for the marketing site
2. `migrations/029_jobber_sync_status.sql` — adds `decorative_concrete`
   enum value + Jobber sync columns + `marketing_leads_view`
3. `migrations/030_calls_table.sql` — call-tracking schema (safe to run
   even before a provider is wired; the table just sits empty)
4. `migrations/033_project_media.sql` — project-scoped photo library
   (table + Storage bucket + RLS + backfill of `projects.service_type`
   from associated leads)

> **Migration number collisions in the folder.** Two pairs of files share
> a number: `029_jobber_sync_status.sql` + `029_message_templates.sql`,
> and `030_calls_table.sql` + `030_business_profile_work_settings.sql`.
> All four are independent and run cleanly. Worth renumbering one of
> each pair next pass for tidiness; not a blocker.

---

## 📷 Project Media (mig 033 + role-aware Finals flow)

### The split: Job Photos vs Finals

This is the marketing-safety equivalent of Jobber's photo workflow.

**Job Photos** — every photo uploaded to the project, regardless of
phase or who uploaded it. Internal record. Includes during-pour shots
that aren't customer-presentable, before-state photos showing damage,
reference shots, etc.

**Finals** — the curated subset that flows to the marketing site.
Strictly defined: `phase = 'after'` AND `is_marketing_eligible = true`.
Same exact filter every marketing helper uses
(`getProjectPhotos`, `getRecentProjectsForGallery`, etc.). If it's in
Finals, it's on the website. If it's not, it's not. No middle state.

### The flow

1. **Crew shoots during the job.** Crew opens `/crew/projects/<id>/photos`
   on their phone, taps "Take photo (camera)", and uploads. Behind the
   scenes:
   - Photo is compressed in-browser (max 2400px, ~500KB target).
   - Uploaded with `phase = during`, `is_marketing_eligible = false`.
     The crew UI doesn't surface either control. The server action
     enforces the same defaults regardless of what the form sends, so
     even a crew member with browser dev tools open can't push a photo
     into Finals directly.
   - Lands in **Job Photos** on the project. Does NOT appear on the
     marketing site.
2. **Office reviews at end of job.** Ronnie (or another admin/office
   user) opens `/dashboard/projects/<id>` and sees:
   - **Top:** "★ Finals · Shown on marketing site" — empty until he
     curates.
   - **Below:** "Job Photos" — every photo crew shot during the job.
   - Each Job Photo has a **"★ Send to Finals"** button. One click sets
     `phase = after` and `is_marketing_eligible = true`. Photo immediately
     appears in Finals AND on the marketing site (next page render or
     ISR refresh).
   - **Bulk select** — checkbox on each Job Photo card; toolbar appears
     when ≥1 selected; one click promotes all selected at once.
3. **Demote if needed.** Photos in Finals get a "Remove from Finals"
   button. Click → `is_marketing_eligible = false`, photo stays on the
   project but disappears from the marketing site.
4. **Hero promotion.** Within Finals, "Hero" elevates a photo to
   priority placement on the home page hero rotation. Independent flag
   from Finals — only Finals photos can be Heroes (UX won't surface the
   Hero button on non-Finals photos in practice; see UI for the visible
   ordering).

### Defense in depth

The Finals criterion lives in three places, all aligned:

1. **Marketing query** — `lib/marketing/project-photos.ts` filters on
   `phase = 'after' AND is_marketing_eligible = true`.
2. **Server action `uploadProjectPhoto`** — when the uploading user's
   role is `crew`, force `phase = 'during'` and
   `is_marketing_eligible = false`, ignoring the form payload.
3. **UI** — crew never sees the phase selector or the marketing toggle.
   Office sees both, plus per-photo Send-to-Finals buttons and a bulk
   toolbar.

A crew member can't push to the website even if they want to. Office
has to say yes.

### Routes

| Route | Role | Purpose |
|---|---|---|
| `/dashboard/projects/<id>` | admin / office | Full project page, Finals + Job Photos, all controls |
| `/crew/projects/<id>/photos` | crew | Snap-and-upload only, read-only Finals view, no controls |

### What's NOT done yet

| Item | Status |
|---|---|
| Caption + alt-text refinement modal on "Send to Finals" | Phase 2 (one-click promote ships now; admins edit alt-text inline pre/post promote) |
| Offline upload queue for crew | Phase 2 |
| Drag-to-reorder photos | Phase 2 (sort_order field is in the table) |
| Lightbox (full-size click-through) | Phase 2 |
| Bulk delete / bulk re-tag | Phase 2 (bulk promote ships) |
| Tighter RLS to "client's assigned crew only" | Phase 2 (current policy: any admin/office/crew on any project) |
| Quote-attach UI on the new-quote form | Phase 2 (helper stubbed at `lib/quote-pdf/photos.ts`) |
| Auto-post to Instagram / Facebook / TikTok | Phase 2 (planned in `lib/social/README.md`) |

### What flows where automatically

- **Marketing site** (`<RecentProjects />`, service detail pages,
  service-area pages): pulls real photos from `marketing_project_media`
  view filtered by `is_marketing_eligible = true`, `phase = 'after'`,
  and project_status. Falls back to the gradient ImageSlot placeholders
  when no real photos exist for the matching service / area.
- **Hero rotation**: photos with `is_hero = true` get top placement.
- **Quote-PDF** (Phase 2 stub at `lib/quote-pdf/photos.ts`): currently
  returns the project's photos by project_id. When the new-quote form
  grows a "Pick reference photos" picker, it'll filter to the same
  service type as the project.

### What's NOT done yet (project_media follow-ups)

| Item | Status |
|---|---|
| Offline upload queue for crew | Phase 2 |
| Drag-to-reorder photos | Phase 2 (sort_order field is in the table) |
| Lightbox (full-size click-through) | Phase 2 |
| Bulk multi-select for delete / re-tag | Phase 2 |
| Tighten RLS to "client's assigned crew only" | Phase 2 (current policy: all admin/office/crew) |
| Quote-attach UI on the new-quote form | Phase 2 (helper stubbed at `lib/quote-pdf/photos.ts`) |
| Auto-post to Instagram / Facebook / TikTok | Phase 2 (planned in `lib/social/README.md`) |

### Storage bucket details

- Bucket: `project-media` (public read, authenticated write)
- Storage path: `projects/<project_id>/<uuid>.<ext>`
- Max file size: 10MB (enforced at the Storage policy + the upload
  server action)
- Accepted formats: JPEG, PNG, WebP (HEIC from iPhone usually
  auto-converts to JPEG when selected)
- Cache header: 1-year immutable (UUID-stable URLs)

### Backfill result

Migration 033 includes a backfill that populates `projects.service_type`
from the most recent `lead.service_type` for any project where
`service_type IS NULL`. This was needed because the marketing
helpers filter by service_type — a NULL silently excludes the project
from the gallery.

The backfill is idempotent. Re-running it after new projects come in is
safe but unnecessary — `lib/leads.ts createLead()` always sets
`service_type` on the project insert, so only legacy / Jobber-imported
projects had nulls.

---

## File index — where placeholders live

| File | Placeholder count |
|---|---|
| `lib/marketing/reviews.ts` | 6 (every entry) |
| `lib/marketing/projects.ts` | 6 (every entry) |
| `lib/marketing/landing-pages.ts` | 1 (Safe Sidewalks project count) |
| `lib/marketing/service-areas.ts` | 12 (local-context copy needs verification) |
| `public/marketing/projects/*.jpg` | 6 image files (don't exist yet) |
| `public/marketing/heroes/*.jpg` | 0 used (form-default hero); add when you want hero photos |
| `.env.local` | `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_GTM_ID`, `CALL_TRACKING_WEBHOOK_SECRET` |

---

## Search-and-replace cheatsheet

To find every placeholder in the codebase:

```bash
grep -rn "PLACEHOLDER" lib/marketing components app
grep -rn "placeholder: true" lib/marketing
grep -rn "IMAGE_SLOT" components lib
```
