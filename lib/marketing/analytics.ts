/**
 * Browser-side analytics fan-out.
 *
 * Two transports here, plus a third fired from the lead-form itself:
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
 *   3. Google Ads conversion — fired directly from
 *      components/marketing/lead-form.tsx so it can attach Enhanced
 *      Conversion user data (email, phone, name, postal code) before
 *      the event. Lives there, not here, because the user data only
 *      exists at the form-submit call site.
 *
 * Window/gtag globals live in types/gtag.d.ts. Every transport is
 * safe to call from anywhere — none throw, none require an env-check
 * at the call site.
 */

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
 * Fire the GA4 `generate_lead` recommended event. Used by the
 * LeadForm after the server-side `/api/leads` call returns ok.
 *
 * GA4 spec: https://support.google.com/analytics/answer/9267735 — the
 * `generate_lead` recommended event uses `value` + `currency` so it
 * shows up in revenue-style dashboards. We send `value: 1` so each
 * lead counts as one conversion (Ronnie can multiply by his average
 * lead value in GA4's settings if he wants $-denominated reporting).
 *
 * The Google Ads conversion event is NOT fired here — it's fired
 * directly from components/marketing/lead-form.tsx so it can attach
 * Enhanced Conversion user data first.
 *
 * Fails silently when the underlying tag isn't loaded — see
 * `try/catch` below. Never blocks the form's success render.
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
}
