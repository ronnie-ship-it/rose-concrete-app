"use client";

import { useEffect } from "react";

/**
 * Dashboard-wide error boundary. Catches any render-time error from any
 * dashboard page or from the layout's children and shows the real
 * message inline instead of a blank 500. Most recent use: diagnosing
 * why /dashboard/settings/import was throwing after migrations 019–021.
 *
 * This replaces the /dashboard/settings/import/error.tsx scoped
 * boundary — one at the layout level is enough and it catches children
 * of /dashboard/* that don't have their own error.tsx.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mirror to the browser console so it shows up in DevTools with the
    // whole stack even when Next's overlay truncates.
    console.error("[dashboard error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-red-50 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-red-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-red-800">
          Dashboard page failed to render
        </h1>
        <p className="text-sm text-neutral-700">
          Something threw during server rendering. The message below is the
          real error — not a generic 500.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-red-50 p-3 text-xs text-red-900">
          {error.message}
        </pre>
        {error.digest && (
          <p className="font-mono text-[11px] text-neutral-500">
            digest: {error.digest}
          </p>
        )}
        {error.stack && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-neutral-600">
              Full stack trace
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 text-[10px] text-neutral-800">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Go to dashboard home
          </a>
        </div>
      </div>
    </div>
  );
}
