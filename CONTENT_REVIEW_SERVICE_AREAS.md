# Content Review — Service-area neighborhood descriptions

**Page template:** `/service-areas/<slug>` (one per city)
**Source:** `lib/marketing/service-areas.ts`

> **STATUS — UPDATED 2026-04-19.** Geographic errors fixed, sealer language
> stripped, "Spanish for the crews" claim removed (unverified), National
> City Safe Sidewalks Program reference rewritten (program is City of
> San Diego only). All "we pour daily / regularly" volume claims kept
> per Ronnie's note that they're true.

---

## ✅ Done in this pass

| City | Edit |
|---|---|
| **National City** | Removed Safe Sidewalks Program work claim (program is City of San Diego only — National City is its own incorporated city). Added explicit "SSP does NOT apply to National City" line so a notice-holder doesn't expect cost-share they can't access. Removed PO-only ZIP `91951`. |
| **City Heights** | Removed "Spanish for the crews where it helps with neighbor coordination" line (unverified). |
| **Solana Beach** | Removed "sealer choices that handle salt and UV" — now says "proper rebar coverage and finish work." |
| **University City** | Fixed geography: "north of I-5" → "between I-5 and I-805 north of La Jolla" (UC straddles I-5). |
| **La Mesa** | Removed PO-only ZIPs `91943`, `91944`. Kept `91941`, `91942`. |
| **Point Loma** | Removed both sealer references (`localContext` + `whyHere`). |
| **Coronado** | "historic island community" → "historic coastal community on the peninsula across from downtown San Diego." Removed "sealer rated for island salt and sun." |

## 🟡 STILL OPEN — needs Ronnie's eyeball

These are claims that aren't urgent but should still get a once-over:

### Geography to spot-check
- 🟡 National City: "many of the single-family homes are decades old" — softened from the original "1940-1970s" range; verify the rough framing matches Ronnie's experience
- 🟡 City Heights: "Spanish revival homes" / "1920s-1940s concrete" — verify era/architecture
- 🟡 City Heights: ZIP `92115` is more College Area / SDSU than core City Heights — verify whether to keep
- 🟡 Solana Beach: "many lots have clay or fill" — soil claim, verify
- 🟡 La Mesa: "east-county hill country" framing — verify (La Mesa is more east-suburban + Mt. Helix than "hill country")
- 🟡 Clairemont: only one ZIP `92117` listed; the area also has `92111` and parts of `92110`. Verify whether to expand
- 🟡 Point Loma vs Ocean Beach: ZIP `92107` is OB (separate community). Verify whether OB should be its own page or stay grouped
- 🟡 Coronado: "water table is high in much of Coronado" — verify (high in some areas, lower in older village core)
- 🟡 Bonita: "long driveways (sometimes 200+ feet to the house)" — verify Ronnie's actually done a 200+ ft Bonita driveway

### Filler that could be sharpened (not wrong, just generic)
- 🟡 Solana Beach: "homeowners aren't looking for the cheapest pour" — could read as condescending toward Solana Beach
- 🟡 University City `whyHere`: "schedule tightly, communicate the day-by-day plan in writing, and clean up so you don't notice the crew was there" — generic, nothing UC-specific
- 🟡 Coronado `whyHere`: "want the look and durability dialed in — we deliver both" — generic
- 🟡 North Park: "dragging the truck through the bougainvillea" — bougainvillea is everywhere in SD, not a North Park specific

### Service-line note (low priority)
- 🟡 Bonita mentions "barn floor slabs" — pure flatwork is fine, but if Ronnie wants to be careful around the "no foundations going forward" rule, the wording could clarify that we mean slab-only (no perimeter footings or wall plates)
- 🟡 La Mesa mentions retaining-wall "proper footings" — utility footings (not building foundations), but worth a once-over

---

## File location for the open items

All city copy lives in `lib/marketing/service-areas.ts` lines 45–178
(the `SERVICE_AREA_CONTENT` object).

Don't touch the rendering template
(`app/(marketing)/service-areas/[slug]/page.tsx`) — copy edits only.
