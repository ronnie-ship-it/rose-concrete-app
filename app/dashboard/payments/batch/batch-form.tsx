"use client";

import { useActionState, useState } from "react";
import {
  generateBatchInvoicesAction,
  type BatchResult,
} from "./actions";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { money, dateShort } from "@/lib/format";

type Candidate = {
  id: string;
  name: string;
  client_name: string;
  completed_at: string | null;
  milestone_count: number;
  total: number;
};

export function BatchInvoiceForm({
  candidates,
}: {
  candidates: Candidate[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<
    BatchResult | null,
    FormData
  >(generateBatchInvoicesAction, null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  }

  const selectedTotal = candidates
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + c.total, 0);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="hidden"
        name="project_ids"
        value={Array.from(selected).join(",")}
      />

      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={
              selected.size === candidates.length && candidates.length > 0
            }
            onChange={toggleAll}
            className="h-4 w-4"
          />
          Select all ({candidates.length})
        </label>
        <p className="text-xs text-neutral-500">
          {selected.size} selected · {money(selectedTotal)}
        </p>
      </div>

      <ul className="divide-y divide-neutral-100">
        {candidates.map((c) => (
          <li key={c.id} className="py-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-0.5 h-4 w-4"
              />
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{c.name}</p>
                <p className="text-xs text-neutral-500">
                  {c.client_name}
                  {c.completed_at && ` · Completed ${dateShort(c.completed_at)}`}
                  {` · ${c.milestone_count} milestone${
                    c.milestone_count === 1 ? "" : "s"
                  }`}
                </p>
              </div>
              <span className="font-semibold text-neutral-900">
                {money(c.total)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
        <SecondaryButton
          type="button"
          onClick={() => setSelected(new Set())}
          disabled={pending || selected.size === 0}
        >
          Clear
        </SecondaryButton>
        <PrimaryButton
          type="submit"
          disabled={pending || selected.size === 0}
        >
          {pending
            ? `Generating ${selected.size}…`
            : `Generate ${selected.size} invoice${
                selected.size === 1 ? "" : "s"
              }`}
        </PrimaryButton>
      </div>

      {state?.ok === true && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-semibold">
            Attempted {state.attempted} · Succeeded {state.succeeded}
            {state.skipped.length > 0 && ` · Skipped ${state.skipped.length}`}
            {state.failed.length > 0 && ` · Failed ${state.failed.length}`}
          </p>
          {state.skipped.length > 0 && (
            <p className="mt-1">
              Skipped:{" "}
              {state.skipped
                .map((s) => `${s.project_id.slice(0, 8)}(${s.reason})`)
                .slice(0, 5)
                .join(", ")}
              {state.skipped.length > 5 && "…"}
            </p>
          )}
          {state.failed.length > 0 && (
            <p className="mt-1 text-red-700">
              Failed:{" "}
              {state.failed
                .map((s) => `${s.project_id.slice(0, 8)}: ${s.error}`)
                .slice(0, 3)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
      {state?.ok === false && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
