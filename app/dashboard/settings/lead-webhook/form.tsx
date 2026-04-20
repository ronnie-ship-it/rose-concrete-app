"use client";

import { useActionState } from "react";
import { toggleLeadWebhookAction, type ToggleState } from "./actions";

export function LeadWebhookForm({
  initial,
}: {
  initial: { enabled: boolean };
}) {
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    toggleLeadWebhookAction,
    null
  );
  return (
    <form
      action={action}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial.enabled}
          className="h-4 w-4"
        />
        <span>Accept posts from the website</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok === true && (
          <span className="text-xs text-green-700">Saved.</span>
        )}
        {state?.ok === false && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
      </div>
    </form>
  );
}
