# Content Review — Safe Sidewalks Program landing page

**Page:** `/landing/safe-sidewalks-program-san-diego`
**Source:** `lib/marketing/landing-pages.ts` → `safeSidewalks` entry
**Rendered by:** `app/(marketing)/landing/[slug]/page.tsx`

> **STATUS — UPDATED 2026-04-19.** Pricing rewritten to match Ronnie's actual
> numbers, surveyor paperwork added to "What you get", site-wide sealer
> language stripped. Items still needing Ronnie's eyeball are flagged
> below as **🟡 STILL OPEN.**

---

## ✅ Done in this pass

1. **Pricing on this page now matches reality:**
   - $3,500 contractor minimum (covers up to ~150 sq ft)
   - Surveyor fee: $1,000 standard, $2,000 if monument needs reset
   - Surveyor cost added to final bill (called out explicitly)
   - Anything beyond ~150 sq ft priced from $17.22/sqft for plain flatwork
2. **Survey paperwork is now on "What you get":**
   > "Surveyor coordination and paperwork: $1,000 if the property monument doesn't need to be reset, $2,000 if it does (added to the final bill)"
3. **`costContext` rewritten** to explain the two-component cost (contractor minimum + surveyor) and that the city's contribution is itemized separately.
4. **`typicalCost.factors[]` adds the surveyor fee line** so it shows up in the page's cost-factors checklist.
5. **All sealer/sealing language stripped** from this page (was in `whatYouGet`, process, etc — nothing left).

## 🟡 STILL OPEN — needs Ronnie's eyeball

These are claims about the program / process / policy that I couldn't
verify. Each is a 30-second read for Ronnie; just needs a yes/no/edit.

### Process & timeline claims (verify against current city behavior)
- 🟡 Hero subhead: "splits the cost of qualifying sidewalk repairs" — verify "splits" vs capped contribution wording
- 🟡 Intro paragraph 2: "Qualifying homeowners pay a portion of the repair cost; the city covers the rest. The program also fast-tracks the permit and inspection" — verify both halves
- 🟡 Process step 3 ("Paperwork + permit"): verify Ronnie does the paperwork hand-holding vs program is now self-serve
- 🟡 Process step 5 ("Inspection sign-off"): verify the 7-day cure → inspector return → citation closes flow
- 🟡 Timeline row "Notice → free site visit · Within 1 week" — verify SLA
- 🟡 Timeline row "Quote → paperwork submitted · 1–2 weeks" — verify
- 🟡 Timeline row "Permit issued → pour day · 2–4 weeks" — depends on whether the surveyor scheduling is on the critical path
- 🟡 Timeline row "Pour → inspection sign-off · 1–2 weeks after pour" — verify

### FAQ claims (one row per FAQ that needs human review)
1. ✅ "I just got a Safe Sidewalks notice. What do I do first?" — safe
2. 🟡 "What is the Safe Sidewalks Program?" — uses "splits the cost" framing, verify
3. 🟡 "Does the program really pay for part of it?" — needs review now that pricing is honest. The "fraction of full private-pay pricing" sentence may need re-toning since the contractor minimum is real money
4. 🟡 "What if I ignore the notice?" — verify that "additional fees, city-ordered repair billed back, lien on property" are accurate consequences
5. 🟡 "Who actually pays the contractor?" — verify the actual payment flow (city → homeowner → contractor vs city → contractor direct)
6. 🟡 "What does 'qualifying repair' mean?" — verify
7. 🟡 "Do I have to be home for the work?" — verify "we'll text you the day before each visit" SLA
8. 🟡 "What if there's a tree root?" — verify "city's urban forestry team" department naming
9. 🟡 "How long does the actual repair take?" — verify "4–8 weeks total" (might be longer if surveyor scheduling is on the critical path)
10. ✅ "Will the new sidewalk match the old?" — technically accurate
11. 🟡 "Can you handle the paperwork for me?" — verify
12. 🟡 "What if my notice has expired?" — verify city actually works with expired notices
13. 🟡 "Can my HOA use this program?" — verify HOA eligibility
14. ✅ "Why hire Rose Concrete specifically for this?" — safe
15. 🟡 "Will the new sidewalk meet ADA cross-slope requirements?" — verify "regrade the base before pouring" is in scope
16. 🟡 "What about my driveway approach (apron at the curb)?" — verify whether SSP covers approach work or it's billed separately

### Placeholder stat — REMOVE OR REPLACE
- 🟣 Callout body still says **"We've handled dozens of Safe Sidewalks Program projects across San Diego County."** Source is flagged `// PLACEHOLDER STAT — REPLACE WITH REAL NUMBER` at `lib/marketing/landing-pages.ts:168`. Either replace with a real number or delete the sentence — leaving as-is implies a count Ronnie hasn't confirmed.

---

## File locations for the open items

- All FAQ + process + timeline + callout copy lives in `lib/marketing/landing-pages.ts` lines 75–255 (the `safeSidewalks` constant)
- Don't touch the rendering template (`app/(marketing)/landing/[slug]/page.tsx`) — copy edits only.
