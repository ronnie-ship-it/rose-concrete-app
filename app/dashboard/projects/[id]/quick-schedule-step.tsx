"use client";

/**
 * Inline "📅 Schedule" control for a single workflow step. One tap
 * expands two inputs (date + time) + a Save button. Designed to get
 * from "tap step" → "visit scheduled" in under 30 seconds on mobile.
 *
 * The server action stamps the step's due_date AND creates a visit
 * so the step also shows up on the calendar + crew app.
 */
import { useState, useTransition } from "react";
import { quickScheduleStepAction } from "@/app/dashboard/workflows/quick-schedule-actions";

export function QuickScheduleStepButton({
  stepId,
  defaultDate,
  defaultTime = "08:00",
}: {
  stepId: string;
  defaultDate?: string | null;
  defaultTime?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10),
  );
  const [time, setTime] = useState(defaultTime);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await quickScheduleStepAction(stepId, date, time);
      if (res.ok) {
        setMsg("✓ Scheduled");
        setOpen(false);
      } else {
        setErr(res.error);
      }
    });
  }

  if (msg) {
    return (
      <span className="text-[11px] font-semibold text-emerald-700">
        {msg}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 active:bg-neutral-50"
      >
        📅 Schedule
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50 p-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-neutral-500 underline"
      >
        Cancel
      </button>
      {err && <span className="w-full text-[11px] text-red-700">{err}</span>}
    </div>
  );
}
