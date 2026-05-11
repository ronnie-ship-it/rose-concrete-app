# Fix: stop "New lead" emails firing on every OpenPhone inbound call

## Status: SHIPPED — 2026-05-10

## Problem

Every inbound OpenPhone call to Ronnie's line was triggering a "New lead"
Resend email from `onboarding@resend.dev`, even when the caller was a
repeat customer. Gmail audit on 2026-05-10 confirmed ~28 such emails in
the prior 7 days, several of them duplicates of the same week's web-form
submissions (e.g. Brian Mirandon submitted the form May 4 then called
May 6 → two separate alerts).

## Root cause

`buildClientLookup()` in `lib/openphone.ts` only consulted the local
Supabase `clients` table to decide whether an inbound caller was
"known". Any caller missing from `clients` — even one who lived in
Jobber, was in OpenPhone contacts, or had prior call/SMS history in
`communications` — fell through to `ensureClientForUnknown()`, which
unconditionally called `createLead()` and fired the owner-notification
email.

Three reasons such callers existed:

- **Stale Jobber import.** No Jobber→Supabase sync cron. Any client
  added to Jobber after the last bulk import (the page at
  `/dashboard/settings/import/jobber-api`) was missing from
  `clients`.
- **Conversation-only history.** Numbers Ronnie had talked or texted
  with but never converted into a saved `clients` row.
- **OpenPhone-only contacts.** Numbers saved on his phone but never
  promoted into Jobber or the app.

## Fix

Suppression gate inside `ensureClientForUnknown()` (`lib/openphone.ts`).
Runs four phone-only lookups in parallel via `Promise.allSettled`. If
any source recognises the number, we return early with `leadCreated:
false` — `createLead()` is NOT called, so no lead/project/quote rows,
no in-app notification, no owner email, no SMS-to-lead. The caller
(`syncOpenPhoneCalls` / `syncOpenPhoneMessages`) still inserts the
`communications` row so call history stays intact.

### Sources checked

1. **Supabase `communications`** — any prior row matching any variant
   from `phoneMatchVariants(phone)`. Cheapest check; catches the long
   tail of "Ronnie has talked to this number but never saved them."
   If the matched row has a `client_id`, that id is returned so the
   new `communications` row attaches to it.
2. **Supabase `clients`** — direct phone match. Defensive: the in-
   memory map in `buildClientLookup` should already catch this, but
   the map is built once per sync batch and won't see clients created
   mid-batch.
3. **Jobber** — phone search via GraphQL `clients(searchTerm:)`. Each
   returned client's `phoneNumbers[].number` is verified against
   `phoneMatchVariants(phone)` because `searchTerm` can fuzzy-match
   substrings. Specifically: a query of `+16195379408` may return a
   client whose stored phone is `(619) 537-9408`; both collapse to
   the same variant set and the gate must accept it.
4. **OpenPhone contacts** — `GET /v1/contacts?phoneNumbers[]=<E.164>`
   via the REST adapter.

### Fail-open semantics

Every source is wrapped in its own try/catch AND inside
`Promise.allSettled`. A thrown lookup is pushed to `errors` and counts
as a miss — never blocks. Rationale: better to email Ronnie once on a
real lead than to silently drop one because Jobber was 500-ing.

- Jobber not connected → token is `null` → Jobber source is skipped
  (not an error).
- OpenPhone API key absent → adapter is the stub → OpenPhone source is
  skipped (not an error).

### Files changed

- `lib/known-caller.ts` (new) — the gate itself; pure function,
  injectable deps.
- `lib/openphone.ts` — added `findContactByPhone()` + `isConfigured()`
  to `OpenPhoneAdapter`. Wired the gate into `ensureClientForUnknown`.
- `lib/jobber-api.ts` — added `getValidJobberAccessToken(supabase)`
  (extracted from the import action so non-import callers can reuse
  it) and `findJobberClientByPhone(token, phone)` with the
  phoneMatchVariants verification step.
- `lib/__tests__/known-caller.test.ts` (new) — 15 unit tests
  covering all sources, the Jobber format-mismatch case, fail-open,
  Supabase-error vs throw, no-token / no-API-key skips, phone
  normalisation, empty-phone short-circuit.
- `package.json` — added `"test"` script using Node's built-in
  `node:test` runner via `tsx` (no new deps).

### Scope notes

- **Inbound SMS** path (`syncOpenPhoneMessages`) shares
  `ensureClientForUnknown` with calls, so the gate covers both. Repeat
  texters no longer fire a new-lead email either — bonus.
- **Web form, `/book`, Poptin, Thumbtack** are deliberately untouched.
  Those are explicit lead-intent signals and the email is the right
  behaviour even for repeat customers.

## Acceptance criteria for QA

- Call from a phone number with prior call OR SMS history in
  `communications` (any direction, any `client_id` state) → no email,
  no leads/projects/quotes inserted; communications row still inserted.
- Call from a phone number that is in Jobber but not in Supabase
  `clients` and has no prior history → no email, communications row
  inserted (`client_id` null).
- Call from a phone number saved in OpenPhone contacts but not in
  Jobber or Supabase and with no prior history → same as above.
- Call from a phone number with NO match across all four systems →
  email fires as today, full new-lead workflow runs.
- Call from a number already in Supabase `clients` → in-memory map
  short-circuits before the gate; behaviour unchanged.
- Web `/book` form / marketing-site lead form → email fires as today
  (gate is not on this path).
- Jobber API is down / 500-ing → email fires (fail-open by design).

## Remaining ops items (orthogonal to the gate)

1. **Run the one-time Jobber bulk import** at
   `/dashboard/settings/import/jobber-api`. Eliminates noise from
   pre-existing Jobber clients in one shot. Gate handles new Jobber
   clients going forward.
2. **Set `LEAD_NOTIFICATION_FROM` on Vercel** to a branded address like
   `Rose Concrete <leads@sandiegoconcrete.ai>` so the remaining
   genuine-new-lead emails don't ship from `onboarding@resend.dev`.

## How to run the tests

```bash
npm test
```

Uses `node:test` + `tsx`. No network, no Supabase, no Jobber. 15
cases, all stubbed in-process. The "Jobber returns
`(619) 537-9408` while query is `+16195379408`" case is in there
explicitly — if format-drift regresses, that test fails first.
