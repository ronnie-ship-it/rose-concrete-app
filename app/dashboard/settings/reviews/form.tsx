"use client";

import { useActionState } from "react";
import {
  saveReviewSettingsAction,
  type SettingsState,
} from "./actions";

export function ReviewSettingsForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    google_review_url: string;
    channel: "email" | "sms";
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveReviewSettingsAction,
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
        <span>
          Enable auto-send (cron will start firing as soon as this is on)
        </span>
      </label>

      <label className="block text-sm">
        <span className="text-neutral-600">Google review URL</span>
        <input
          type="url"
          name="google_review_url"
          defaultValue={initial.google_review_url}
          placeholder="https://g.page/r/..."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-neutral-600">Channel</span>
        <select
          name="channel"
          defaultValue={initial.channel}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
      </label>

      <div className="flex items-center gap-3 pt-2">
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
