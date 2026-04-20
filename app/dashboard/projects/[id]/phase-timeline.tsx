"use client";

/**
 * Visual phase timeline on the project detail page.
 *
 * Horizontal "pill" per phase with color + date-range + status.
 * Clicking a phase expands it inline — dates editor, notes, text
 * draft editor, and a "Send text" button that delivers the drafted
 * SMS via OpenPhone (never auto-sends).
 *
 * Supports: seed phases (if empty), edit dates/notes, mark scheduled/
 * done/skipped, send draft text, and edit the text before sending.
 */
import { useState, useTransition } from "react";
import type { PhaseRow, PhaseStatus } from "@/lib/phases";
import { DEFAULT_PHASES } from "@/lib/phases";
import {
  seedPhasesAction,
  updatePhaseAction,
  sendPhaseTextAction,
  completePhaseAction,
} from "./phase-actions";

const STATUS_COLOR: Record<PhaseStatus, string> = {
  pending: "bg-neutral-200 text-neutral-700",
  scheduled: "bg-sky-200 text-sky-900",
  in_progress: "bg-amber-200 text-amber-900",
  done: "bg-emerald-200 text-emerald-900",
  skipped: "bg-neutral-200 text-neutral-400 line-through",
};

const STATUS_LABEL: Record<PhaseStatus, string> = {
  pending: "Not scheduled",
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  skipped: "Skipped",
};

export function PhaseTimeline({
  projectId,
  phases: initialPhases,
}: {
  projectId: string;
  phases: PhaseRow[];
}) {
  const [phases, setPhases] = useState<PhaseRow[]>(initialPhases);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // When the project has no phase rows yet, we render placeholder
  // pills for the five default phases so the timeline is always
  // visible. The "Create phases to edit" button seeds them.
  if (phases.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-brand-700 dark:bg-brand-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Phase timeline
          </h2>
          <button
            type="button"
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await seedPhasesAction(projectId);
                if (!res.ok) setError(res.error);
                else window.location.reload();
              });
            }}
            disabled={pending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create phases to edit"}
          </button>
        </div>
        <ol className="flex flex-wrap gap-2">
          {DEFAULT_PHASES.map((p) => (
            <li key={p.kind}>
              <span
                className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 dark:bg-brand-700 dark:text-neutral-300"
                title={`${p.label} (~${p.defaultDurationDays}d)`}
              >
                <span>{p.label}</span>
                <span className="font-normal opacity-60">TBD</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          The timeline will go live once you click{" "}
          <strong>Create phases to edit</strong>. Each phase gets its
          own dates, status, and auto-drafted SMS (demo → Willy, pour
          → Willy / Roger / Michael, cleanup → crew).
        </p>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Phase timeline
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {phases.filter((p) => p.status === "done").length} / {phases.length} done
        </span>
      </div>

      {/* Horizontal pill track */}
      <ol className="flex flex-wrap gap-2">
        {phases.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setExpanded((e) => (e === p.id ? null : p.id))}
              aria-label={`${p.label} — ${STATUS_LABEL[p.status]}`}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                STATUS_COLOR[p.status]
              } ${expanded === p.id ? "ring-2 ring-brand-400" : ""}`}
            >
              <span>{p.label}</span>
              <span className="font-normal opacity-75">
                {formatRange(p.start_date, p.end_date)}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {expanded && (
        <PhaseEditor
          key={expanded}
          projectId={projectId}
          phase={phases.find((p) => p.id === expanded)!}
          onPatch={(patch) =>
            setPhases((prev) =>
              prev.map((p) =>
                p.id === expanded ? ({ ...p, ...patch } as PhaseRow) : p,
              ),
            )
          }
          onClose={() => setExpanded(null)}
        />
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}

function PhaseEditor({
  projectId,
  phase,
  onPatch,
  onClose,
}: {
  projectId: string;
  phase: PhaseRow;
  onPatch: (patch: Partial<PhaseRow>) => void;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [startDate, setStartDate] = useState(phase.start_date ?? "");
  const [endDate, setEndDate] = useState(phase.end_date ?? "");
  const [notes, setNotes] = useState(phase.notes ?? "");
  const [draftBody, setDraftBody] = useState(phase.text_draft_body ?? "");
  const [draftTo, setDraftTo] = useState(phase.text_draft_to ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function savePatch(patch: {
    start_date?: string | null;
    end_date?: string | null;
    status?: PhaseStatus;
    notes?: string;
  }) {
    setErr(null);
    start(async () => {
      const res = await updatePhaseAction(phase.id, patch);
      if (!res.ok) {
        setErr(res.error);
      } else {
        onPatch(patch as Partial<PhaseRow>);
        setMsg("Saved.");
        setTimeout(() => setMsg(null), 1500);
        // Re-fetch the phase so draft body is fresh (updatePhaseAction
        // regenerates the template when dates are set).
        if (patch.status === "scheduled" || patch.start_date) {
          // Not strictly needed; the drafted text is best viewed on
          // full reload for this flow.
        }
      }
    });
  }

  function sendText() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await sendPhaseTextAction(phase.id, {
        body: draftBody,
        to: draftTo,
      });
      if (res.ok) {
        setMsg("✓ Sent.");
        onPatch({ text_sent_at: new Date().toISOString() });
      } else {
        setErr(res.error);
      }
    });
  }

  function markDone() {
    setErr(null);
    start(async () => {
      const res = await completePhaseAction(phase.id);
      if (res.ok) {
        onPatch({ status: "done" });
        setMsg("Marked done.");
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-brand-700 dark:bg-brand-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900 dark:text-white">
          {phase.label}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="block text-neutral-600 dark:text-neutral-300">
            Start
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={() => savePatch({ start_date: startDate || null })}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block text-neutral-600 dark:text-neutral-300">
            End
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => savePatch({ end_date: endDate || null })}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <label className="block text-xs">
        <span className="block text-neutral-600 dark:text-neutral-300">
          Notes
        </span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => savePatch({ notes })}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {phase.status !== "scheduled" && phase.status !== "done" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => savePatch({ status: "scheduled" })}
            className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Mark scheduled
          </button>
        )}
        {phase.status !== "in_progress" && phase.status !== "done" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => savePatch({ status: "in_progress" })}
            className="rounded-md border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Start
          </button>
        )}
        {phase.status !== "done" && (
          <button
            type="button"
            disabled={pending}
            onClick={markDone}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Mark done
          </button>
        )}
        {phase.status !== "skipped" && phase.status !== "done" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => savePatch({ status: "skipped" })}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Skip
          </button>
        )}
      </div>

      {/* Draft text editor — shown for phases that have templates. */}
      {["demo", "prep", "pour", "cleanup"].includes(phase.kind) && (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-3 dark:border-brand-700 dark:bg-brand-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              OpenPhone draft
            </p>
            {phase.text_sent_at && (
              <span className="text-[11px] text-emerald-700">
                ✓ Sent {new Date(phase.text_sent_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <label className="block text-xs">
            <span className="block text-neutral-600 dark:text-neutral-300">
              To
            </span>
            <input
              type="text"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              placeholder="+1… , +1…"
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-neutral-600 dark:text-neutral-300">
              Body
            </span>
            <textarea
              rows={4}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            disabled={pending || !draftBody.trim() || !draftTo.trim()}
            onClick={sendText}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending
              ? "Sending…"
              : phase.text_sent_at
                ? "Send again"
                : "Review + send"}
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "TBD";
  const fmt = (d: string) => {
    const date = new Date(d + (d.length === 10 ? "T12:00:00" : ""));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start ?? end ?? "");
}
