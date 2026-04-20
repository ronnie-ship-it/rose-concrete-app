"use client";

import { useTransition, useState } from "react";
import { updateRequestStatusAction } from "./actions";

const TRANSITIONS: Record<
  string,
  Array<{ label: string; next: "new" | "contacted" | "qualified" | "converted" | "lost"; tone?: "primary" }>
> = {
  new: [
    { label: "Mark contacted", next: "contacted", tone: "primary" },
    { label: "Qualified", next: "qualified" },
    { label: "Dismiss", next: "lost" },
  ],
  contacted: [
    { label: "Qualified", next: "qualified", tone: "primary" },
    { label: "Converted", next: "converted" },
    { label: "Lost", next: "lost" },
  ],
  qualified: [
    { label: "Converted", next: "converted", tone: "primary" },
    { label: "Lost", next: "lost" },
  ],
  converted: [{ label: "Reopen", next: "new" }],
  lost: [{ label: "Reopen", next: "new" }],
};

export function RequestActions({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const options = TRANSITIONS[currentStatus] ?? TRANSITIONS.new;

  function go(next: "new" | "contacted" | "qualified" | "converted" | "lost") {
    setErr(null);
    start(async () => {
      const res = await updateRequestStatusAction(leadId, next);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.next}
            type="button"
            disabled={pending}
            onClick={() => go(o.next)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-60 ${
              o.tone === "primary"
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
