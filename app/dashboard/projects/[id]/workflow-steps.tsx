"use client";

import { useState, useTransition } from "react";
import {
  updateWorkflowStepAction,
  type WorkflowStepResult,
} from "@/app/dashboard/workflows/actions";
import type { ProjectWorkflowStep } from "@/lib/workflows";
import { stepIsStale } from "@/lib/workflows";

/**
 * Ordered checklist of workflow steps for a project. Each row shows
 * status, responsible role, due date, and the metadata fields that
 * matter for the sidewalk-permit flow (submission date, permit number,
 * survey send date).
 *
 * Dependency gating lives server-side in the action; the UI mirrors it
 * by disabling the Start / Mark done buttons until the predecessor is
 * closed. That gives Ronnie a visible signal instead of a cryptic
 * error on submit.
 */

type Profile = { id: string; full_name: string | null };

export function WorkflowSteps({
  projectId,
  steps,
  profiles,
}: {
  projectId: string;
  steps: ProjectWorkflowStep[];
  profiles: Profile[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(steps.map((s) => [s.id, s]));
  const completedSequences = new Set(
    steps.filter((s) => s.status === "done" || s.status === "skipped").map((s) => s.sequence)
  );

  function dispatch(
    stepId: string,
    input: Parameters<typeof updateWorkflowStepAction>[2]
  ) {
    setError(null);
    start(async () => {
      const res: WorkflowStepResult = await updateWorkflowStepAction(
        projectId,
        stepId,
        input
      );
      if (!res.ok) setError(res.error);
    });
  }

  function predecessorDone(step: ProjectWorkflowStep): boolean {
    if (step.depends_on_sequence == null) return true;
    return completedSequences.has(step.depends_on_sequence);
  }

  return (
    <section className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {steps.map((s) => {
        const blocked = !predecessorDone(s) && s.status === "pending";
        const stale = stepIsStale(s);
        return (
          <div
            key={s.id}
            className={`rounded-lg border p-4 shadow-sm transition ${
              s.status === "done"
                ? "border-green-200 bg-green-50/40"
                : stale
                  ? "border-amber-300 bg-amber-50"
                  : blocked
                    ? "border-neutral-200 bg-neutral-50 opacity-80"
                    : "border-neutral-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-mono">{s.sequence}/{steps.length}</span>
                  <StatusPill status={s.status} />
                  {stale && (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                      stale &gt; 3 biz days
                    </span>
                  )}
                  {s.responsible_role && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                      {s.responsible_role}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-neutral-900">
                  {s.title}
                </h3>
                {s.description && (
                  <p className="mt-1 text-xs text-neutral-600">{s.description}</p>
                )}
                <StepMetaFields step={s} onChange={(meta) => dispatch(s.id, { metadata: meta })} pending={pending} />
              </div>
              <div className="flex flex-col items-end gap-2 text-xs">
                <AssigneePicker
                  value={s.assigned_to}
                  profiles={profiles}
                  onChange={(v) => dispatch(s.id, { assigned_to: v })}
                  disabled={pending}
                />
                <DueDateInput
                  value={s.due_date}
                  onChange={(v) => dispatch(s.id, { due_date: v })}
                  disabled={pending}
                />
                <div className="flex gap-1">
                  {s.status === "pending" && (
                    <button
                      type="button"
                      disabled={pending || blocked}
                      onClick={() => dispatch(s.id, { status: "in_progress" })}
                      className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      title={blocked ? "Waiting on previous step" : "Start step"}
                    >
                      Start
                    </button>
                  )}
                  {s.status !== "done" && (
                    <button
                      type="button"
                      disabled={pending || blocked}
                      onClick={() => dispatch(s.id, { status: "done" })}
                      className="rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ✓ Done
                    </button>
                  )}
                  {s.status === "done" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => dispatch(s.id, { status: "pending" })}
                      className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-neutral-100 text-neutral-600",
    in_progress: "bg-brand-100 text-brand-700",
    done: "bg-green-100 text-green-800",
    skipped: "bg-neutral-200 text-neutral-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        map[status] ?? "bg-neutral-100"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function DueDateInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-neutral-500">
      Due
      <input
        type="date"
        defaultValue={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px]"
      />
    </label>
  );
}

function AssigneePicker({
  value,
  profiles,
  onChange,
  disabled,
}: {
  value: string | null;
  profiles: Profile[];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      defaultValue={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px]"
    >
      <option value="">Unassigned</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.full_name ?? "(no name)"}
        </option>
      ))}
    </select>
  );
}

/**
 * Per-step metadata fields. Different steps in Ronnie's 11-step process
 * need to log different things:
 *   - step 3 (submit to city) → submission_date
 *   - step 4 (forward survey) → survey_sent_at
 *   - step 6 (final paperwork) → submission_date
 *   - step 7 (city approval) → permit_number, permit_approved_at, permit_expires_at
 *
 * We key off the step sequence + title for now — a cleaner version would
 * move the field config into the workflow template JSON, but the
 * fidelity matters more than the abstraction for the MVP.
 */
function StepMetaFields({
  step,
  onChange,
  pending,
}: {
  step: ProjectWorkflowStep;
  onChange: (meta: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const fields = fieldsForStep(step);
  if (fields.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col text-[10px] text-neutral-500">
          {f.label}
          <input
            type={f.type}
            defaultValue={(step.metadata?.[f.key] as string | undefined) ?? ""}
            disabled={pending}
            onBlur={(e) => {
              const v = e.currentTarget.value;
              if (v === ((step.metadata?.[f.key] as string | undefined) ?? "")) return;
              onChange({ [f.key]: v });
            }}
            className="mt-0.5 rounded border border-neutral-300 px-2 py-1 text-[11px] text-neutral-900"
          />
        </label>
      ))}
    </div>
  );
}

function fieldsForStep(step: ProjectWorkflowStep): { key: string; label: string; type: "date" | "text" }[] {
  const t = step.title.toLowerCase();
  if (t.includes("submit to city") || t.includes("submit completed") || t.includes("send final")) {
    return [{ key: "submission_date", label: "Submission date", type: "date" }];
  }
  if (t.includes("forward survey") || t.includes("wait for survey")) {
    return [
      { key: "survey_sent_at", label: "Survey sent", type: "date" },
      { key: "survey_received_at", label: "Survey received", type: "date" },
    ];
  }
  if (t.includes("receive city approval")) {
    return [
      { key: "permit_number", label: "Permit #", type: "text" },
      { key: "permit_approved_at", label: "Approval date", type: "date" },
      { key: "permit_expires_at", label: "Expiration", type: "date" },
    ];
  }
  if (t.includes("schedule demo")) {
    return [{ key: "scheduled_for", label: "Scheduled for", type: "date" }];
  }
  return [];
}
