"use client";

/**
 * Archive / unarchive control on the client detail page. Archiving
 * keeps all the client's quotes / projects / invoices / history but
 * hides the client from the default list. A reason field is optional
 * — Ronnie typically leaves it blank, but "moved out of area" / "not
 * a fit" is useful when a client comes back a year later.
 */
import { useState, useTransition } from "react";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "../actions";

export function ArchiveClientButton({
  clientId,
  archivedAt,
}: {
  clientId: string;
  archivedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);

  if (archivedAt) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
        <span className="font-semibold text-amber-900">
          Archived {new Date(archivedAt).toLocaleDateString()}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await unarchiveClientAction(clientId);
              if (!res.ok) setError(res.error);
            });
          }}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "…" : "Restore"}
        </button>
        {error && <span className="text-red-700">{error}</span>}
      </div>
    );
  }

  if (!showReason) {
    return (
      <button
        type="button"
        onClick={() => setShowReason(true)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        title="Hide this client from the active list without losing any history"
      >
        Archive client
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="min-w-[12rem] flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
        disabled={pending}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await archiveClientAction(clientId, reason);
            if (!res.ok) setError(res.error);
            else setShowReason(false);
          });
        }}
        className="rounded-md bg-neutral-700 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
      <button
        type="button"
        onClick={() => {
          setShowReason(false);
          setReason("");
          setError(null);
        }}
        className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:underline"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
