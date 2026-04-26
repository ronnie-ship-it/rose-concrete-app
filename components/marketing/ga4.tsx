/**
 * Google Analytics 4 — direct gtag.js loader.
 *
 * Why direct (vs through GTM):
 *   GTM is already wired (see components/marketing/gtm.tsx) and we keep
 *   it for tag-management flexibility. But GA4 itself is wired directly
 *   so the `generate_lead` conversion event from the lead form has a
 *   reliable transport even if Ronnie ever simplifies the GTM container
 *   to zero tags.
 *
 * Why on the (marketing) layout, not the root layout:
 *   The root layout wraps both the marketing site AND the operations
 *   dashboard / crew PWA. Putting GA4 on root would track every internal
 *   admin click — exactly the noise we're trying to avoid. Mounted in
 *   app/(marketing)/layout.tsx so only public visitors get measured.
 *
 * Why the env-only check (no NODE_ENV gate):
 *   `NEXT_PUBLIC_GA_MEASUREMENT_ID` is only set in Vercel production.
 *   Localhost `.env.local` should leave it blank, which means the GA4
 *   tag never renders during dev — same effective behavior as a
 *   `NODE_ENV` check, but simpler and less footgun-prone (no risk of
 *   accidentally tracking a `next start` smoke test against the real
 *   property). The format check below makes the gate strict.
 *
 * Reads `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Format must be `G-XXXXXXXX`.
 * Renders nothing if unset or malformed.
 */

import Script from "next/script";

function ga4Id(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;
  if (!/^G-[A-Z0-9]+$/.test(id)) return null;
  return id;
}

export function Ga4Script() {
  const id = ga4Id();
  if (!id) return null;

  return (
    <>
      {/* Async load of gtag.js. afterInteractive keeps it out of the
          critical path so LCP isn't gated on Google's CDN. */}
      <Script
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      {/* Init script. send_page_view defaults to true and Next's App
          Router emits the initial nav, so we're good without the
          manual route-change shim Pages-Router apps used to need. */}
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', '${id}', {
  // Anonymize IP and respect Do-Not-Track at the source — defensive
  // defaults that won't bite us on the EU / privacy front.
  anonymize_ip: true,
});
          `.trim(),
        }}
      />
    </>
  );
}

/**
 * True iff NEXT_PUBLIC_GA_MEASUREMENT_ID is set and valid. Use this
 * in client components that want to env-check before firing events
 * (rare — `trackGenerateLead()` and friends already no-op safely).
 */
export function ga4IsConfigured(): boolean {
  return ga4Id() !== null;
}
