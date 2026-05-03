export {};

// Single source of truth for the gtag.js globals. Loaded sitewide by
// the root layout (app/layout.tsx) when NEXT_PUBLIC_GOOGLE_ADS_ID is
// set, and used by components/marketing/lead-form.tsx to fire the
// Enhanced-Conversions event. Marked optional because dev (no env
// var) intentionally renders neither script — every call site must
// guard with `typeof window.gtag === "function"`.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
