"use client";

import { useState, useTransition } from "react";
import {
  resolveProjectRowAction,
  resolveQuoteRowAction,
  dismissReviewRowAction,
} from "./actions";

type Suggestion = {
  id: string;
  name: string;
  reason: string;
  distance: number;
};

export function ReviewRowActions({
  reviewId,
  kind,
  suggestions,
  clients,
}: {
  reviewId: string;
  kind: string;
  suggestions: Suggestion[];
  clients: Array<{ id: string; name: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedOther, setPickedOther] = useState<string>("");

  function resolveTo(clientId: string) {
    setError(null);
    start(async () => {
      const res =
        kind === "project"
          ? await resolveProjectRowAction(reviewId, clientId)
          : kind === "quote"
            ? await resolveQuoteRowAction(reviewId, clientId)
            : {
                ok: false as const,
                error: `Unsupported kind: ${kind}`,
              };
      if (!res.ok) setError(res.error);
    });
  }

  function dismiss() {
    if (!confirm("Dismiss this row? It won't be imported.")) return;
    setError(null);
    start(async () => {
      const res = await dismissReviewRowAction(reviewId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => resolveTo(s.id)}
              className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-60"
            >
              ✓ {s.name}
              <span className="ml-1 text-[10px] text-brand-600">
                ({s.reason})
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pickedOther}
          onChange={(e) => setPickedOther(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs"
        >
          <option value="">Or pick any client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pickedOther || pending}
          onClick={() => resolveTo(pickedOther)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Assign
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={dismiss}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
