"use client";

/**
 * Print button on the cash-journal PDF view. Also kicks off
 * window.print() automatically once the page has mounted (behind a
 * small delay so the browser's fonts + images finish rendering),
 * so clicking "Print / Export PDF" on the parent page feels like a
 * one-click export. Users can still trigger again manually via the
 * button. Skip auto-print with `?noautoprint=1`.
 */
import { useEffect } from "react";

export function PrintButton() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      new URLSearchParams(window.location.search).get("noautoprint") === "1"
    )
      return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
    >
      Print / Save PDF
    </button>
  );
}
