# Deploy checklist — sandiegoconcrete.ai

**Stakes:** 116k organic search impressions / 618 clicks per quarter on
the existing Duda site. The new Next.js site replaces it. The deploy
needs to:

1. Stand up the new site on the production domain
2. Preserve the SEO equity from the old site (66 redirects, all
   permanent-308, defined in `next.config.mjs`)
3. Light up GA4 + Google Ads conversion tracking from minute one
4. Keep the operations app (`app.sandiegoconcrete.ai`) untouched

This checklist is the linear sequence to do that without breakage.
Read it top-to-bottom on deploy day.

---

## 0. Final pre-deploy state (verified 2026-04-25)

```
TypeScript:     clean (npx tsc --noEmit)
Build:          ✓ 126 static pages generated in ~2s
GA4 tag:        ✓ G-7611WCEGNL present on marketing pages
Google Ads tag: ✓ AW-17622554294 present on marketing pages
                ✓ Conversion label AkHQCMKc3aYbELati9NB present
Admin host:     ✓ ZERO GA4 / Google Ads tags on app.* pages
Redirects:      ✓ Sample 308s verified (concrete-driveway → driveways,
                  la-jolla--ca → service-areas/la-jolla,
                  encinitas → service-areas/solana-beach,
                  concrete-foundations → services)
Migration 033:  ❌ NOT applied yet (project_media table absent — site
                  works fine, ImageSlot placeholders render in the
                  Recent Projects grid until photos go live)
```

---

## 1. Vercel environment variables

Set these in Vercel → Project Settings → Environment Variables. **Set
each in BOTH `Production` and `Preview` environments** (Preview lets
you verify on a `*.vercel.app` URL before flipping DNS).

### Required for marketing site to work

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://...supabase.co` | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase) | Same as `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase) | Same as `.env.local` |

### Required for lead pipeline (SMS + email + owner notification)

| Variable | Value | Notes |
|---|---|---|
| `OPENPHONE_API_KEY` | (from OpenPhone) | Auto-SMS to lead |
| `OPENPHONE_PHONE_NUMBER_ID` | `PNsajzJYr6` | Pinned to (619) 537-9408 |
| `RESEND_API_KEY` | (from Resend) | Lead-confirmation + owner email |
| `RESEND_FROM_EMAIL` | `Rose Concrete <leads@sandiegoconcrete.ai>` | After Resend domain verify; until then use `onboarding@resend.dev` |
| `LEAD_NOTIFICATION_EMAIL` | `ronnie@sandiegoconcrete.ai` | Where the owner-notification lands |

### Required for analytics (the whole point of this checklist)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-7611WCEGNL` |
| `NEXT_PUBLIC_GADS_CONVERSION_ID` | `AW-17622554294/AkHQCMKc3aYbELati9NB` |

### Optional

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | Skip unless you set up a GTM container. GA4 + Ads are wired direct already. |
| `ANTHROPIC_API_KEY` | For AI alt-text generation on project_media uploads. Skip until mig 033 is applied. |
| `LEAD_WEBHOOK_SECRET` | Only if you want the legacy `/api/public/lead` endpoint live for the existing Poptin form. |

---

## 2. Order of operations

### A. Deploy to Vercel (NO DNS change yet)

1. Push the current branch to the repo. (Repo isn't initialized
   locally — if it's already on a remote like GitHub, push there.
   If not, `git init && git add -A && git commit -m "..." &&
   git remote add origin ... && git push -u origin main`. This
   step is the one I cannot do for you per the constraints.)
2. In Vercel: connect the repo, ensure all env vars from §1 are set
   in BOTH Production and Preview, deploy.
3. Vercel will give you a `*.vercel.app` URL. **Test on that URL
   before touching DNS.**

### B. Verify on the Vercel preview URL

Hit the preview URL and walk through:

- [ ] Home page loads, hero + form visible above the fold
- [ ] Submit a real lead with your own phone + email. Confirm:
  - SMS arrives at your phone from `(619) 537-9408`
  - "Thanks" email arrives at your inbox
  - Owner notification arrives at `ronnie@sandiegoconcrete.ai`
  - Lead row appears in Supabase `leads` table with
    `source = "marketing/"`
- [ ] Open browser dev tools → Network tab → submit again. Look for:
  - `https://www.googletagmanager.com/gtag/js?id=G-7611WCEGNL` (GA4 loader)
  - `https://www.googletagmanager.com/gtag/js?id=AW-17622554294` (Ads loader)
  - A `collect?...&en=generate_lead` request to `google-analytics.com`
    (the GA4 conversion event)
  - A `collect?...&t=conversion&...` request (the Google Ads conversion)
- [ ] In a new tab, open https://analytics.google.com → Reports →
  Realtime. Confirm the form-submit event shows up within ~30 seconds.
- [ ] Spot-check a few redirects on the preview URL with curl:
  ```
  curl -I https://<vercel-url>/services/concrete-driveway
  curl -I https://<vercel-url>/services/la-jolla--ca
  curl -I https://<vercel-url>/services/encinitas
  ```
  Each should return `HTTP/1.1 308 Permanent Redirect` with the
  expected `location:` header.
- [ ] Verify `/sitemap.xml` lists all 27 marketing routes (1 home +
  7 services + 10 landing + 13 service-areas (now with La Jolla) +
  about + contact + 2 indexes).

### C. DNS flip at GoDaddy

Only after §B passes.

1. Log into GoDaddy → DNS Manager for `sandiegoconcrete.ai`.
2. Replace the existing A / CNAME records pointing at Duda with
   Vercel's records (Vercel's domain settings will show you the exact
   values; typically a CNAME `cname.vercel-dns.com` for `www` and an
   A record for the apex).
3. Verify the operations subdomain `app.sandiegoconcrete.ai` still
   points where it always did (the existing Vercel project for the
   ops app — the marketing-site Vercel project is a SEPARATE project,
   or the same project with host-based routing in `middleware.ts`).
   If you're using one project for both surfaces (the current setup),
   the DNS for `app.*` and the apex both point at the same Vercel
   project; nothing changes for `app.*`.
4. Propagation typically completes in 5–15 min on GoDaddy. Use
   https://www.whatsmydns.net/#A/sandiegoconcrete.ai to verify.

### D. Post-DNS verification (within 15 min of flip)

- [ ] `curl -I https://www.sandiegoconcrete.ai/` returns 200
- [ ] `curl -I https://sandiegoconcrete.ai/` returns 200 (or 301 → www)
- [ ] `curl -I https://www.sandiegoconcrete.ai/services/concrete-driveway`
      returns 308 → `/services/driveways`
- [ ] `https://www.sandiegoconcrete.ai/sitemap.xml` resolves
- [ ] `https://www.sandiegoconcrete.ai/robots.txt` resolves and points
      at the new sitemap
- [ ] Submit ANOTHER real lead from your phone via the live URL.
      End-to-end pipeline confirmed on real DNS.
- [ ] In Google Search Console:
  - Both properties (Domain + URL prefix) are still verified
  - Submit the new sitemap: `https://www.sandiegoconcrete.ai/sitemap.xml`
  - In "URL Inspection," paste a few high-traffic old URLs (e.g.
    `/top-rated-concrete-contractor-san-diego`) and request indexing
    so Google revisits them and sees the new 308 redirect.
- [ ] In Google Ads (account 343-521-6133):
  - Conversions → "Submit lead form" should auto-flip from "Inactive"
    to "Active" within ~24 hours of the first form submit on the new site
  - Re-enable the paid campaigns once the conversion goes Active

### E. First 48 hours — watch for problems

- [ ] GA4 → Reports → Realtime: confirm consistent traffic
- [ ] GA4 → Reports → Engagement → Events → `generate_lead` is firing
- [ ] Google Search Console → Coverage: watch for unexpected 404s
- [ ] Google Search Console → Performance: top 10 queries should still
      be ranking. If `concrete contractors san diego` (top query) drops
      below position 10, investigate immediately.
- [ ] Test phone calls — call (619) 537-9408 from the website's CTA
      links, confirm OpenPhone receives.
- [ ] Test text-now SMS link from mobile — confirm it opens the
      messages app pre-populated.

---

## 3. Rollback plan

If something goes catastrophically wrong (site down, lead pipeline
broken, GA4 traffic vanishes), here's how to back out.

### Soft rollback (DNS hasn't propagated everywhere yet)

If you catch a problem within 15 min of the DNS flip:

1. In GoDaddy DNS, point the records back at Duda.
2. Within 5–15 min, traffic flips back to the old site.
3. Diagnose the new-site issue locally without time pressure.

### Hard rollback (DNS has propagated, real traffic seeing breakage)

1. **Don't touch DNS.** A second flip just doubles the propagation
   time. Instead:
2. In Vercel → Deployments → find the previous good deployment →
   "Promote to Production." Vercel routes traffic to the old build
   in seconds, no DNS change needed.
3. If the previous deployment was the OLD Duda site (i.e. there's no
   "previous Vercel deployment to fall back to" because Duda was
   never on Vercel), then yes, flip DNS back to Duda — but only as
   a last resort. Tell users via OpenPhone if you can.

### Lead pipeline is the most important thing — verify separately

If the SITE works but leads aren't arriving:

1. Check Vercel → Functions → /api/leads logs for errors
2. Check Resend dashboard for delivery failures
3. Check OpenPhone API logs for 4xx/5xx
4. Worst case: temporarily put a static "Call (619) 537-9408" page
   up via Vercel → drop it in `app/page.tsx` → emergency redeploy.
   Pipeline can be fixed without users ever seeing a broken form.

---

## 4. What this checklist intentionally doesn't do

- **Does NOT touch the operations dashboard** (`app.sandiegoconcrete.ai`).
  Same Vercel project, same code, same Supabase. The marketing site
  goes live; nothing about the dashboard / crew PWA / leads queue
  changes.
- **Does NOT run the pending Supabase migrations** (029a, 029b, 030a,
  030b, 031, 032, 033, 034–039). The marketing site works without
  them. Mig 033 (project_media) is the most-relevant unrun migration —
  applying it lights up the photo system so real project photos
  start flowing to the marketing site automatically. Worth applying
  in the week after deploy.
- **Does NOT renumber the migration-number-collision files** (029×2,
  030×2, 033×2). Cosmetic; runs cleanly as-is.
- **Does NOT push to git.** No git remote configured locally per
  earlier session.

---

## 5. Files modified in the pre-deploy session (for code-review reference)

```
.env.local                                  ← added NEXT_PUBLIC_GADS_CONVERSION_ID
components/marketing/ga4.tsx                ← NEW
components/marketing/google-ads.tsx         ← NEW
components/marketing/lead-form.tsx          ← +trackGenerateLead, swap to MARKETING_FORM_SERVICE_TYPES
lib/marketing/analytics.ts                  ← +trackGenerateLead helper
lib/marketing/brand.ts                      ← +La Jolla in SERVICE_AREAS
lib/marketing/service-areas.ts              ← +La Jolla content entry
lib/service-types.ts                        ← +EXCLUDED_FROM_MARKETING_FORM, +MARKETING_FORM_SERVICE_TYPES
next.config.mjs                             ← +66 redirects, +redirect tweaks for foundation/north-county/La Jolla
app/(marketing)/layout.tsx                  ← +Ga4Script, +GoogleAdsScript
.env.local.example                          ← +NEXT_PUBLIC_GA_MEASUREMENT_ID, +NEXT_PUBLIC_GADS_CONVERSION_ID
URL_MIGRATION_PLAN.md                       ← updated with 2026-04-25 decisions
DEPLOY_CHECKLIST.md                         ← THIS FILE (NEW)
```
