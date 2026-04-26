/**
 * Browser-side analytics fan-out.
 *
 * Three independent transports, all called from the same call sites:
 *
 *   1. GTM dataLayer — `pushEvent({ event: "lead_submitted", ... })`
 *      Pushes to window.dataLayer for any GTM-managed tags. No-op if
 *      NEXT_PUBLIC_GTM_ID isn't configured (the dataLayer push still
 *      happens, but no tag listens).
 *
 *   2. GA4 gtag — `trackGenerateLead({ ... })`
 *      Fires the canonical GA4 `generate_lead` recommended event so
 *      the property's "Conversions" report shows lead volume per
 *      page. No-op if window.gtag isn't loaded (env unset).
 *
 *   3. Google Ads conversion — same `trackGenerateLead({ ... })`
 *      If `window.ROSE_GADS_CONVERSION` is set (see
 *      components/marketing/google-ads.tsx), also fires
 *      `gtag('event', 'conversion', { send_to: ... })`. No-op until
 *      the conversion ID + label are pasted in.
 *
 * Every transport is safe to call from anywhere — none throw, none
 * require an env-check at the call site.
 */

// ─── Type augmentations ────────────────────────────────────────────────

type GtagFn = (
  command: "event" | "config" | "js" | "set",
  ...args: unknown[]
) => void;

declare global {
  interface Window {
    dataLayer?: object[];
    gtag?: GtagFn;
    /** Set by components/marketing/google-ads.tsx when env is configured.
     *  Format: "AW-XXXXXXXXX/AbCdEfGhIj" */
    ROSE_GADS_CONVERSION?: string;
  }
}

// ─── GTM dataLayer transport ───────────────────────────────────────────

type DataLayerEvent =
  | {
      event: "lead_submitted";
      source_page: string;
      service_type?: string;
      had_phone: boolean;
      had_email: boolean;
    }
  | {
      event: "phone_click";
      source_page: string;
      placement?: string;
    }
  | {
      event: "sms_click";
      source_page: string;
      placement?: string;
    };

export function pushEvent(payload: DataLayerEvent): void {
  if (typeof window === "undefined") return;
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push(payload);
}

// ─── GA4 + Google Ads conversion transport ─────────────────────────────

export type GenerateLeadParams = {
  /** Pathname the form was submitted from (e.g.
   *  "/landing/safe-sidewalks-program-san-diego"). */
  source_page: string;
  /** Pre-fill enum value from the form's project-type dropdown. */
  service_type?: string;
};

/**
 * Fire the GA4 `generate_lead` recommended event AND the Google Ads
 * conversion event in one call. Used by the LeadForm after the
 * server-side `/api/leads` call returns ok.
 *
 * GA4 spec: https://support.google.com/analytics/answer/9267735 — the
 * `generate_lead` recommended event uses `value` + `currency` so it
 * shows up in revenue-style dashboards. We send `value: 1` so each
 * lead counts as one conversion (Ronnie can multiply by his average
 * lead value in GA4's settings if he wants $-denominated reporting).
 *
 * Both events fail silently when the underlying tag isn't loaded —
 * see `try/catch` below. Never blocks the form's success render.
 */
export function trackGenerateLead(params: GenerateLeadParams): void {
  if (typeof window === "undefined") return;

  // GA4 — generate_lead recommended event.
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", {
        value: 1,
        currency: "USD",
        source_page: params.source_page,
        ...(params.service_type ? { service_type: params.service_type } : {}),
      });
    }
  } catch (err) {
    // Never let a tag failure break the form's success path.
    // eslint-disable-next-line no-console
    console.warn("[analytics] GA4 generate_lead failed:", err);
  }

  // Google Ads — conversion event. Only fires when the conversion
  // ID + label have been pasted into NEXT_PUBLIC_GADS_CONVERSION_ID
  // (see components/marketing/google-ads.tsx).
  try {
    if (
      typeof window.gtag === "function" &&
      typeof window.ROSE_GADS_CONVERSION === "string" &&
      window.ROSE_GADS_CONVERSION.length > 0
    ) {
      window.gtag("event", "conversion", {
        send_to: window.ROSE_GADS_CONVERSION,
        value: 1.0,
        currency: "USD",
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[analytics] Google Ads conversion failed:", err);
  }
}
