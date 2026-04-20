"use client";

import { useState, useTransition } from "react";
import { flagClientForJobberSync } from "./jobber-sync-actions";

/**
 * "Push to Jobber" stub button on the client detail page.
 *
 * Today: toggles `clients.jobber_sync_status` between 'not_synced',
 * 'pending', and 'excluded'. No actual API call to Jobber yet.
 *
 * When the Jobber API integration lands, the cron picks up
 * status='pending' rows, attempts a push, and flips to 'synced' or
 * back to 'not_synced' with an error log.
 */

type Status = "pending" | "synced" | "excluded" | "not_synced";

const LABEL: Record<Status, string> = {
  not_synced: "Not synced",
  pending: "Sync pending",
  synced: "Synced ✓",
  excluded: "Excluded",
};

export function JobberSyncButton({
  clientId,
  current,
}: {
  clientId: string;
  current: Status;
}) {
  const [optimistic, setOptimistic] = useState<Status>(current);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function flag(target: "pending" | "excluded") {
    setErr(null);
    setOptimistic(target);
    startTransition(async () => {
      const res = await flagClientForJobberSync(clientId, target);
      if (!res.ok) {
        setErr(res.error);
        setOptimistic(current);
      }
    });
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
            Jobber Sync
          </p>
          <p className="mt-1 text-sm font-semibold text-violet-900">
            {LABEL[optimistic]}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`mt-1 inline-block h-2 w-2 rounded-full ${
            optimistic === "synced"
              ? "bg-emerald-500"
              : optimistic === "pending"
                ? "bg-amber-500"
                : optimistic === "excluded"
                  ? "bg-neutral-400"
                  : "bg-neutral-300"
          }`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {optimistic !== "synced" && optimistic !== "pending" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => flag("pending")}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Push to Jobber
          </button>
        )}
        {optimistic !== "excluded" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => flag("excluded")}
            className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            Exclude from sync
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-violet-700/80">
        Stub — flips the sync status. The actual Jobber API push wires up
        in a separate integration session.
      </p>
      {err && <p className="mt-1 text-[11px] text-red-700">Error: {err}</p>}
    </div>
  );
}
