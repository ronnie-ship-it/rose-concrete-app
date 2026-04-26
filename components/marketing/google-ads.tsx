/**
 * Google Ads conversion tag — STUB.
 *
 * TODO: Add Google Ads conversion ID once retrieved from account
 * 343-521-6133. The conversion ID + label come from Ads → Tools →
 * Conversions → "View tag setup" on the lead-form conversion action.
 *
 * Once retrieved, set `NEXT_PUBLIC_GADS_CONVERSION_ID` in Vercel to
 *   AW-XXXXXXXXX/AbCdEfGhIjKlMnOpQ
 * (the full send_to value with the conversion-action label after the
 * slash). The format check below validates that shape so a partial
 * paste — just the AW- prefix without the label — won't render.
 *
 * Why on the (marketing) layout, not the root layout:
 *   Same reasoning as GA4 — keeps internal admin clicks out of Ads
 *   audience signals. See components/marketing/ga4.tsx for the full
 *   note.
 *
 * What it does today: nothing — env is unset, tag doesn't render.
 * What it'll do once env is set:
 *   1. Loads `gtag.js` for the AW- account (separate Google tag
 *      from the GA4 G- tag).
 *   2. Exposes `window.ROSE_GADS_CONVERSION` = the full send_to
 *      string, so the lead-form's conversion-fire helper can reach
 *      it without reading process.env from the browser.
 *
 * Conversion firing (when env is set): see lib/marketing/analytics.ts
 * → `trackGenerateLead()`. That helper reads the same env var
 * and fires `gtag('event', 'conversion', { send_to: ... })` after
 * a successful lead submission.
 */

import Script from "next/script";

const SEND_TO_PATTERN = /^AW-[0-9]+\/[A-Za-z0-9_-]+$/;

function googleAdsSendTo(): string | null {
  const v = process.env.NEXT_PUBLIC_GADS_CONVERSION_ID;
  if (!v) return null;
  if (!SEND_TO_PATTERN.test(v)) return null;
  return v;
}

function googleAdsAccountId(): string | null {
  const sendTo = googleAdsSendTo();
  if (!sendTo) return null;
  // "AW-12345/abcDEF" → "AW-12345"
  return sendTo.split("/")[0];
}

export function GoogleAdsScript() {
  const sendTo = googleAdsSendTo();
  const accountId = googleAdsAccountId();
  if (!sendTo || !accountId) return null;

  return (
    <>
      {/* Loader — separate tag URL keyed on the AW- account, even though
          GA4 already loaded gtag.js. Google's docs explicitly recommend
          loading once per account ID; the underlying gtag function is
          shared. */}
      <Script
        id="gads-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${accountId}`}
        strategy="afterInteractive"
      />
      <Script
        id="gads-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', '${accountId}');
window.ROSE_GADS_CONVERSION = '${sendTo}';
          `.trim(),
        }}
      />
    </>
  );
}

/** True iff the Google Ads conversion env var is set and well-formed. */
export function googleAdsIsConfigured(): boolean {
  return googleAdsSendTo() !== null;
}
