/**
 * Tiny GTM dataLayer wrapper.
 *
 * Use from client components only — this touches `window`. The marketing
 * site fires three events:
 *
 *   lead_submitted  — fired on /api/leads success (LeadForm)
 *   phone_click     — fired on any click-to-call link
 *   sms_click       — fired on any text/SMS link
 *
 * If GTM isn't loaded (NEXT_PUBLIC_GTM_ID unset), the dataLayer push
 * still happens but no tags fire — making it safe to call from anywhere
 * without env-checking at the call site.
 */

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
      placement?: string; // "header" | "hero" | "mobile_bar" | etc.
    }
  | {
      event: "sms_click";
      source_page: string;
      placement?: string;
    };

declare global {
  interface Window {
    dataLayer?: object[];
  }
}

export function pushEvent(payload: DataLayerEvent): void {
  if (typeof window === "undefined") return;
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push(payload);
}
