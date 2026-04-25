# Night-audit findings

Things spotted while doing the Safe Sidewalks + service-areas content
review (April 19 night session). Items 1–4 below were resolved in a
follow-up pass after Ronnie weighed in on pricing + service-line policy.

## ✅ Resolved in the follow-up pass

| Item | Resolution |
|---|---|
| 1. National City Safe Sidewalks claim | Rewritten — page now explicitly says SSP does NOT apply to National City and points homeowners with NC sidewalk notices to call us for private-pay options. |
| 2. Safe Sidewalks pricing | Rewritten to match Ronnie's numbers: $3,500 contractor minimum (covers up to ~150 sq ft), surveyor fee $1,000 / $2,000 added to final bill. Surveyor line item added to "What you get". |
| 3. Pricing on other landing/service pages | All 14 typicalCost blocks across `services.ts` and `landing-pages.ts` now use the $17.22/sqft floor framing for plain broom flatwork. Specific dollar examples that contradicted the floor have been replaced with factor-based language. |
| 4. Sealer / concrete sealing references | Stripped site-wide. Customer-facing pages (services, landing, service-areas, projects) have ZERO sealer mentions. The remaining hits in this file and the two CONTENT_REVIEW companion files are deliberate (they're documenting WHY the strip happened). |

---

## 🔴 Critical-ish

### 1. National City Safe Sidewalks Program claim is probably wrong
**Where:** `lib/marketing/service-areas.ts` line 52 — National City `localContext` paragraph 2.

> "We also do a fair amount of Safe Sidewalks Program work in National City — the city has been actively issuing notices, and the program splits the cost so it's the right time to address it."

The Safe Sidewalks Program is a **City of San Diego** program. National
City is its own incorporated city — different government, different
sidewalk-repair program (or none). A homeowner clicking from this page
expecting program cost-share they can't actually access is the worst
kind of marketing-site error: erodes trust on the first interaction.

Also flagged in `CONTENT_REVIEW_SERVICE_AREAS.md` (item 4 in summary).

### 2. Pricing data on Safe Sidewalks landing page doesn't match Ronnie's actual numbers
Already covered in detail in `CONTENT_REVIEW_SAFE_SIDEWALKS.md`. Mentioning
here so it shows up in a single "things to fix" rollup.

The current page implies Safe Sidewalks comes out to ~$200–$1,000 for a
typical job. Ronnie's actual numbers say $3,500 minimum + $1,000–$2,000
surveyor. That's a 5–10× discrepancy — homeowners will be sticker-shocked
on the quote.

---

## 🟡 Wider scope than this audit

### 3. Pricing in OTHER landing/service pages may have the same gap
**Files:** `lib/marketing/services.ts` (7 `typicalCost` blocks) and
`lib/marketing/landing-pages.ts` (12 `typicalCost` blocks, total).

The Safe Sidewalks page isn't the only one with specific dollar figures.
Spot-checked a few:
- Driveways: "$8–$14 per square foot," "$3,200–$5,600" example
- Patios: "$2,700–$3,300 broomed, $4,200–$5,400 stamped"
- Stamped patio landing: "$5,600–$7,200" example

Each of these needs the same fact-check pass Ronnie is doing on Safe
Sidewalks. Suggest: review the others before pointing any paid traffic
at the corresponding landing pages.

### 4. "Sealer" / "concrete sealing" appears widely — verify service-line policy
**Why this came up:** the task brief said Rose Concrete "doesn't offer concrete sealing"
going forward. Sealer language is everywhere on the site:

- `lib/marketing/services.ts`: 9+ references — sealer as a "what's included" bullet on multiple services, sealer choice as a `typicalCost` factor on patios/decorative, FAQ referencing "needs re-sealing every few years"
- `lib/marketing/landing-pages.ts`: 12+ references — sealer rated for pool chemistry, sealed for SoCal sun, etc.
- `lib/marketing/service-areas.ts`: 3 references (Solana Beach, Point Loma, Coronado) — sealer choice as a coastal value prop

If "no concrete sealing" means **no standalone resealing of existing slabs**,
the current copy is OK as-is — sealer is being applied as part of the new
pour, not pitched as a return-visit service. Recommend a single sentence in
each "What's included" bullet: "Sealer applied with the new pour" so it's
unambiguous.

If "no concrete sealing" means **no sealer at all (none on new pours either)**,
that's a much bigger rewrite — every pour-finish bullet across all three files
needs the sealer line removed, and the cost factors that include sealer
choice need adjustment.

### 5. Migration number collisions persist
Already documented in CONTENT_REVIEW.md. Re-noting here because it's still
true and a fresh person walking into this repo will trip on it:

- `029_jobber_sync_status.sql` + `029_message_templates.sql`
- `030_business_profile_work_settings.sql` + `030_calls_table.sql`
- `033_products_services_catalog.sql` + `033_project_media.sql`

All six are independent and run cleanly in either order. Worth renumbering
when there's a quiet moment, before more migrations stack up. **The user's
prompt explicitly said NOT to renumber tonight** — leaving as-is.

---

## 🔵 Small / cosmetic

### 6. ZIP code list quality varies across service areas
Some entries claim PO-box-only ZIPs alongside delivery ZIPs, others are
overly narrow (single ZIP for Clairemont, which has multiple delivery
ZIPs). 10-minute audit job. Flagged in `CONTENT_REVIEW_SERVICE_AREAS.md`
item 7.

### 7. Coronado is technically a peninsula, not an island
Colloquial use is fine, but `lib/marketing/service-areas.ts` line 162 says
"historic island community." Ronnie's call on whether to use the colloquial
or the technical term.

### 8. University City "north of I-5" is geographically off
`lib/marketing/service-areas.ts` line 85. UC straddles I-5 (UCSD west,
UTC east). Better framing: "between I-5 and I-805, north of La Jolla."

### 9. City Heights "Spanish for the crews" claim should be verified before publish
`lib/marketing/service-areas.ts` line 65. Claims the crews can speak
Spanish for neighbor coordination. If untrue, this is the kind of small
falsehood that reads as a brand-trust hit if a Spanish-speaking neighbor
calls the office expecting Spanish on the line.

---

## ✅ Verified during the audit (no action needed)

- Both broken-import bugs from the original task brief are already fixed:
  - `app/dashboard/requests/request-actions.tsx` exists
  - `app/dashboard/settings/automations/rule-toggle.tsx` exists
- `npx tsc --noEmit` runs clean across the whole repo as of this audit
- The `automation_config` / `automation_rule_runs` tables referenced by the
  automations settings page exist in `migrations/021_jobber_parity_batch_1.sql`
  (so the page works today, no missing migration)
- The two new content-review docs (`CONTENT_REVIEW_SAFE_SIDEWALKS.md` and
  `CONTENT_REVIEW_SERVICE_AREAS.md`) live at the project root alongside the
  existing `CONTENT_REVIEW.md`
