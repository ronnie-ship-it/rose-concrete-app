"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { runJobberImportTickAction, type TickResult } from "./actions";

/**
 * Self-pacing import runner. Clicks "Start" → fires a single
 * `runJobberImportTickAction` → on success, if `done` is false, queues
 * the next tick. Progress counters are driven by whatever the server
 * returns so a page reload mid-import picks up from the same spot
 * (counters live on the `jobber_oauth_tokens` row).
 */
export function ImportRunner({
  initial,
}: {
  initial: {
    clients_processed: number;
    notes_imported: number;
    attachments_imported: number;
    started_at: string | null;
    finished_at: string | null;
    last_error: string | null;
    has_pending_cursor: boolean;
  };
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({
    clients: initial.clients_processed,
    notes: initial.notes_imported,
    attachments: initial.attachments_imported,
    skipped: 0,
  });
  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >(() => {
    if (initial.last_error) return "error";
    if (initial.finished_at && !initial.has_pending_cursor) return "done";
    if (initial.has_pending_cursor || initial.started_at) return "idle";
    return "idle";
  });
  const [lastError, setLastError] = useState<string | null>(initial.last_error);
  const [, startTransition] = useTransition();
  const stopRef = useRef(false);

  const tick = useCallback(async (): Promise<TickResult> => {
    return await runJobberImportTickAction();
  }, []);

  const runLoop = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    setStatus("running");
    setLastError(null);

    // Keep ticking until either the server reports done, a tick fails,
    // or the user clicks Stop.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (stopRef.current) {
        setStatus("idle");
        setRunning(false);
        return;
      }
      const r = await tick();
      if (!r.ok) {
        setLastError(r.error);
        setStatus("error");
        setRunning(false);
        return;
      }
      setProgress((p) => ({
        clients: r.clients_processed,
        notes: r.notes_imported,
        attachments: r.attachments_imported,
        skipped: p.skipped + r.skipped_clients,
      }));
      if (r.done) {
        setStatus("done");
        setRunning(false);
        return;
      }
      // Tiny pacing delay to keep the UI responsive and avoid hammering
      // Jobber's rate limit back-to-back.
      await new Promise((res) => setTimeout(res, 400));
    }
  }, [tick]);

  // If the page loads and an import was already partway through (cursor
  // set but no finished_at), offer to resume.
  useEffect(() => {
    // Noop on mount — Ronnie hits Resume/Start explicitly.
  }, []);

  const handleStart = () => {
    startTransition(() => {
      runLoop();
    });
  };
  const handleStop = () => {
    stopRef.current = true;
  };

  const label =
    initial.has_pending_cursor && status === "idle"
      ? "Resume import"
      : status === "done"
      ? "Run again"
      : "Start import";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Clients processed" value={progress.clients} />
        <Stat label="Notes imported" value={progress.notes} tone="good" />
        <Stat
          label="Photos imported"
          value={progress.attachments}
          tone="good"
        />
      </div>
      {progress.skipped > 0 && (
        <p className="text-[11px] text-amber-800">
          {progress.skipped} Jobber client{progress.skipped === 1 ? "" : "s"}{" "}
          didn&apos;t match an existing client in the app and were skipped.
          Import the clients CSV first, then re-run.
        </p>
      )}

      {lastError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {lastError}
        </p>
      )}

      {status === "done" && (
        <p className="rounded-md bg-accent-50 px-3 py-2 text-xs text-brand-700">
          ✓ Import complete. You can re-run safely — existing notes and
          attachments are deduped by Jobber&apos;s id.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={running}
          onClick={handleStart}
          className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {running ? "Importing…" : label}
        </button>
        {running && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-neutral-900";
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${toneClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
