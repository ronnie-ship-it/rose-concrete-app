"use client";

import { useActionState } from "react";
import { updateWorkspaceAction, type WorkspaceResult } from "./actions";

export function WorkspaceForm({
  initial,
}: {
  initial: { name: string; slug: string };
}) {
  const [state, formAction, pending] = useActionState<
    WorkspaceResult | null,
    FormData
  >(updateWorkspaceAction, null);

  return (
    <form action={formAction} className="grid gap-3 text-sm sm:grid-cols-2">
      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Company name
        </span>
        <input
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial.name}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Slug (optional)
        </span>
        <input
          type="text"
          name="slug"
          pattern="[a-z0-9-]+"
          defaultValue={initial.slug}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
          placeholder="bay-area-concrete"
        />
      </label>
      <div className="sm:col-span-2 flex items-center justify-end gap-3">
        {state?.ok === true && (
          <span className="text-xs text-emerald-700">Saved ✓</span>
        )}
        {state?.ok === false && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save workspace"}
        </button>
      </div>
    </form>
  );
}
