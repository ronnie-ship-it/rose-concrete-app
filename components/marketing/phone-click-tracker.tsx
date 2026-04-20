"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pushEvent } from "@/lib/marketing/analytics";

/**
 * One-shot delegated event listener for click-to-call and click-to-text.
 *
 * Attaches a single document-level click handler that watches for any
 * <a href="tel:..."> or <a href="sms:..."> click anywhere on the page
 * and fires a GTM `phone_click` / `sms_click` event with the current
 * pathname as the source page.
 *
 * Picks up an optional `data-cta-placement` attribute on the link (or
 * any ancestor) so we can distinguish "header" vs "hero" vs "mobile_bar"
 * vs "footer" CTA in the analytics report.
 *
 * Mounted once in the marketing layout — every tel:/sms: link in the
 * site is instrumented automatically with no code changes per link.
 */

export function PhoneClickTracker() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href) return;
      const placementEl = anchor.closest("[data-cta-placement]") as
        | HTMLElement
        | null;
      const placement =
        placementEl?.dataset.ctaPlacement ??
        anchor.dataset.ctaPlacement ??
        undefined;

      if (href.startsWith("tel:")) {
        pushEvent({ event: "phone_click", source_page: pathname, placement });
      } else if (href.startsWith("sms:")) {
        pushEvent({ event: "sms_click", source_page: pathname, placement });
      }
    }
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
