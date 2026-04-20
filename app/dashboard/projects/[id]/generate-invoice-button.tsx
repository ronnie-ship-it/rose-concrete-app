"use client";

import { useTransition } from "react";

/**
 * One-click "generate invoice" for a job. Shown only when the project has
 * a payment schedule but no QBO invoice id yet — so it's the natural next
 * action right after Ronnie converts a quote to a job.
 */
export function GenerateInvoiceButton({
  action,
  projectName,
}: {
  action: () => Promise<void>;
  projectName: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            `Generate a QBO invoice for "${projectName}"? This pulls every milestone in the payment schedule and creates one invoice in QuickBooks.`
          )
        )
          return;
        start(() => action());
      }}
      className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-60"
    >
      {pending ? "Generating…" : "📄 Generate invoice"}
    </button>
  );
}
