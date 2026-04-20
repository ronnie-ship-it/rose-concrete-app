/**
 * Google Tag Manager scaffolding.
 *
 * Reads NEXT_PUBLIC_GTM_ID. Renders nothing if unset (safe for dev /
 * preview environments where you don't want to fire production tags).
 *
 * Two pieces:
 *   <GtmHeadScript />  — loads the GTM container in <head>
 *   <GtmNoScript />    — <noscript> iframe in <body>, per Google's spec
 *
 * Both go in app/(marketing)/layout.tsx. App-side surfaces (dashboard,
 * crew) deliberately skip GTM.
 *
 * Event firing helpers live in lib/marketing/analytics.ts so any
 * client component can `pushEvent({ event: "lead_submitted", ... })`
 * without re-stringifying the dataLayer push.
 */

import Script from "next/script";

function gtmId(): string | null {
  const id = process.env.NEXT_PUBLIC_GTM_ID;
  if (!id || !/^GTM-[A-Z0-9]+$/.test(id)) return null;
  return id;
}

export function GtmHeadScript() {
  const id = gtmId();
  if (!id) return null;
  return (
    <Script
      id="gtm-head"
      strategy="afterInteractive"
      // dangerouslySetInnerHTML is the canonical Next.js GTM pattern.
      dangerouslySetInnerHTML={{
        __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');
        `.trim(),
      }}
    />
  );
}

export function GtmNoScript() {
  const id = gtmId();
  if (!id) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
