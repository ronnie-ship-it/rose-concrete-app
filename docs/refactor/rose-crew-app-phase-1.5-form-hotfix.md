# Rose Concrete Crew App — Phase 1.5 Form UX Hotfix Brief

**Date:** 2026-04-30
**Repo:** `ronnie-ship-it/rose-concrete-app`
**Scope:** two acute mobile-form bugs reported on real devices. Ships as a small hotfix between Phase 1 and the larger Phase 3 PR-Y (universal Create form rewrite). Hotfix is form-shell + Add Client only; the same patterns roll out to all Create forms in PR-Y.

> **Suggested branch:** `refactor/pr-a1-form-mobile-hotfix`. Independent of PR-A. Can ship before, after, or in parallel.

---

## Bug 1 — Save button overlaps the address input

### Symptom (reported)
On Add Client, when typing into the address field, the Save button sits on top of the input and cuts off most of what's been entered. The user can't see the full address as they type.

### Root cause hypothesis
A sticky/fixed footer holding the Save button is layered on top of the form scroll area without bottom-padding to keep content clear of it. When the mobile virtual keyboard slides up, the visual viewport shrinks but the fixed footer stays anchored to the layout-viewport bottom — so the address input gets sandwiched between keyboard and footer.

### Files likely involved
- `app/crew/create/client/page.tsx` — the form
- `app/crew/create/_components/CreateFormShell.tsx` (or similar) — the sticky footer
- `app/crew/create/_components/CreateFooter.tsx` — Save / Cancel button row
- Any global `<form-footer>` style in `app/crew/styles/` or token CSS

### Fix approach

> **Updated 2026-04-30 after Day 2 audit.** Day 2 confirmed Jobber's mobile forms have **no fixed/sticky footer** — Save is rendered inline at the bottom of the natural scroll. The fix is therefore architectural, not layering: remove the footer, render Save inline. See `jobber-mobile-ui-audit-day2.md` §A.

1. **Render Save and Cancel as the last items in the form's scroll, not a footer.** Buttons are children of the form body, not of a separate footer container. No `position: fixed`. No `position: sticky`. No backdrop blur.
   ```tsx
   <form className="px-4 pb-8 space-y-4" style={{paddingBottom:'calc(env(safe-area-inset-bottom)+24px)'}}>
     {fields}
     <div className="pt-4 space-y-3">
       <SaveButton />     {/* full-width, --brand-900 bg */}
       <CancelLink />     {/* text link, centered */}
     </div>
   </form>
   ```
2. **`<CrewBottomNav>` stays sticky at the viewport bottom — it's untouched.** The form body scrolls; the bottom nav doesn't. iOS resizes the visual viewport when the keyboard opens; both adjust correctly without overlap.

3. **Optional fields render as tap-to-reveal rows.** Per Day 2 §C.1, only First name + Last name + Property address show by default in Add Client. Phone, Email, Company Name, Lead Source, Notes, Tags render as `<button>` rows with leading icons that swap to a real `<TextField>` on tap.
   ```tsx
   {phoneRevealed
     ? <TextField name="phone" label="Phone" inputMode="tel" autoFocus />
     : <RevealRow icon={Phone} label="Add Phone Number" onClick={() => setPhoneRevealed(true)} />}
   ```

4. **Keep the `scrollIntoView` helper on focusin.** Useful for jumping to error fields after submit-fail; harmless when the keyboard is already showing the input.
   ```tsx
   useEffect(() => {
     const handler = (e: FocusEvent) => {
       const el = e.target as HTMLElement;
       if (el?.matches('input, textarea, select')) {
         setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
       }
     };
     document.addEventListener('focusin', handler);
     return () => document.removeEventListener('focusin', handler);
   }, []);
   ```

5. **Address autocomplete dropdown** — when present, render the suggestions menu *below* the input under normal circumstances. If the menu would overflow the viewport bottom, flip to `bottom: 100%` (above input). Day 2 didn't cover Jobber's autocomplete behavior; default to the standard pattern.

**Why this is simpler than the original v1 plan:** v1 proposed a sticky footer with bottom-padding and z-index management. Day 2 ground truth says Jobber doesn't have that footer at all. Removing it removes the bug at its root — there's nothing to overlap when nothing is sticky. Net: less code, fewer edge cases, fix is architectural.

### Acceptance criteria
- On iPhone Safari with the keyboard open, the address input is fully visible (top to bottom, with cursor) when focused. Save button does not overlap the field's text.
- On Android Chrome, same.
- The form scroll area always has at least 16 px clearance above the footer.
- Tabbing through fields scrolls each focused input into view.

### Manual test plan
- iPhone Safari: open `/crew/create/client`, focus the address input, type a long string ("4901 Providence Rd, Charlotte, NC 28210"). Verify the full string is visible and the Save button does not overlap.
- Android Chrome: same.
- Rotate device to landscape mid-input — input remains visible.

---

## Bug 2 — Can't see what you're typing in Add Client

### Symptom (reported)
On Add Client, the user cannot see the text they're typing. Cursor and characters are invisible or very hard to read.

### Likely root causes (in order of probability)

1. **iOS Safari auto-zoom.** When an input's `font-size` is less than 16 px, Safari zooms in on focus. The zoom can push the input partially off-screen, so the visible content is offset. *The fix is always 16 px minimum.*
2. **Text color matches background.** Input text is set to `color: var(--text-on-brand)` (white) or similar, but the input background is also white. Common when an input style is reused from a button style.
3. **Placeholder doesn't transition to value.** Placeholder color (`--text-dim`, light gray) is intentional, but if the value uses the same color via cascade, the typed text reads like a placeholder.
4. **Caret invisible on dark theme remnants.** A leftover `caret-color: white` from the early Jobber-mimic dark theme renders an invisible caret on a white input.

### Files likely involved
- `app/crew/styles/tokens.css` (or wherever input styles live)
- `app/crew/_components/Input.tsx` (or `<TextField>`) — shared input component
- Tailwind config — `theme.fontSize.base` if it's < 16 px
- Any leftover `text-white` / `caret-white` classes in input usage

### Fix approach

1. **Minimum input font-size 16 px.** Set in the shared input component and as a Tailwind/global rule:
   ```css
   input, textarea, select {
     font-size: max(16px, 1rem);  /* 16px floor; honors larger Dynamic Type */
   }
   ```
   In Tailwind, ensure `text-base` resolves to ≥ 16 px on mobile.

2. **Force input text and caret colors:**
   ```css
   .crew-input {
     color: var(--text);            /* near-black */
     caret-color: var(--brand-900); /* navy */
     background: var(--surface);    /* white */
     -webkit-text-fill-color: var(--text); /* iOS Safari workaround */
   }
   .crew-input::placeholder {
     color: var(--text-dim);
   }
   ```
   The `-webkit-text-fill-color` line specifically fixes a long-standing iOS bug where input text reads as gray/invisible despite `color` being set.

3. **Sweep for leftover dark-theme classes.** Grep:
   ```bash
   grep -rE "text-white|caret-white|placeholder-white" app/crew
   ```
   Replace any input-context occurrences with the token-driven classes above.

4. **One shared `<TextField>` component.** Don't let raw `<input>` elements ship from form pages. Centralizing styling in `app/crew/_components/TextField.tsx` is what makes Bug 2 a one-time fix instead of a recurring whack-a-mole.

### Acceptance criteria
- On iOS Safari, focusing any input does not trigger zoom (no viewport scale change).
- Typed text is fully visible: high contrast (WCAG AA against white surface), caret blinks in `--brand-900`, placeholder is clearly distinct.
- Same behavior on Android Chrome.

### Manual test plan
- iPhone Safari, open `/crew/create/client`, focus First name → no zoom. Type "Linda" → visible high-contrast black text. Cursor visible.
- Repeat for every field on the form.
- Repeat on Android Chrome.

---

## Universal mobile-form rules (apply once, benefit everywhere)

These are extracted from the two bugs above and applied across the form shell. Centralize now to avoid filing the same bugs against each Create form (`task`, `expense`, `quote`, `job`, etc.) in turn.

### `<CreateFormShell>` props/responsibilities
- Renders header (title + Cancel ✕), scrollable body, sticky footer (Save / Save & New).
- Body has bottom padding `var(--form-footer-h)` + safe-area inset.
- Footer is `position: sticky`, white BG, top hairline, contains primary + secondary buttons.
- Auto-focuses first invalid field on submit.
- Handles `focusin` to scroll focused input into view on mobile.

### `<TextField>` props/responsibilities
- One control, one source of truth for input styling.
- Props: `label`, `name`, `value`, `onChange`, `error`, `required`, `autoComplete`, `inputMode`, `type`.
- Renders label above, input below, error message below input (red text, not URL bar).
- `font-size: 16px` minimum, navy caret, near-black text, `-webkit-text-fill-color` set.
- `min-height: 48px` to meet touch-target rule.
- `inputMode` defaults sensibly: `tel` for phone, `email` for email, `decimal` for amount, `text` otherwise.

### `<AddressField>` (specialization)
- Wraps `<TextField>` with autocomplete (Google Places or Mapbox).
- Autocomplete menu opens upward when within 200 px of the bottom of the viewport.
- Selecting a suggestion fills street, city, state, zip into hidden fields the form submits.
- "Use my current location" button (calls `navigator.geolocation` with explicit user tap, never automatic).

### Files to ship in this PR
- `app/crew/_components/CreateFormShell.tsx` (NEW)
- `app/crew/_components/TextField.tsx` (NEW or rewrite of existing)
- `app/crew/_components/AddressField.tsx` (NEW)
- Replace the form shell + raw `<input>` usage in `app/crew/create/client/page.tsx` only (the bug repro)
- Tokens added to `tokens.css`: `--form-footer-h`, input color tokens

Out of scope (defer to PR-Y):
- Apply `<CreateFormShell>` and `<TextField>` to the other five Create forms (task, expense, invoice, quote, job).
- Inline validation polish, required-field asterisks, duplicate detection.
- Save & New button behavior.

-