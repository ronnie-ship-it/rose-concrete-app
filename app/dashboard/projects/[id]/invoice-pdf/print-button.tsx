"use client";

/**
 * Thin wrapper around window.print() so the print button has its own
 * client component without the whole invoice-pdf page having to be
 * client-rendered. Matches the pattern used by
 * `/dashboard/clients/[id]/statement/print-button.tsx`.
 */
export function PrintButton() {
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
