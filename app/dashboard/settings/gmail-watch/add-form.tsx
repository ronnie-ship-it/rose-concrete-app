"use client";

import { useActionState } from "react";
import {
  addWatchedSenderAction,
  type GmailWatchResult,
} from "./actions";
import { PrimaryButton } from "@/components/ui";

export function AddSenderForm() {
  const [state, formAction, pending] = useActionState<
    GmailWatchResult | null,
    FormData
  >(addWatchedSenderAction, null);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-4">
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="surveys@sandiego.gov"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Label
        </span>
        <input
          name="label"
          placeholder="Survey routing"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="md:col-span-2">
        <span className="block text-xs font-medium text-neutral-600">
          Note
        </span>
        <input
          name="note"
          placeholder="What does this sender do?"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="md:col-span-4 flex justify-end">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add sender"}
        </PrimaryButton>
      </div>
      {state?.ok === false && (
        <p className="md:col-span-4 text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok === true && (
        <p className="md:col-span-4 text-sm text-emerald-700">Added.</p>
      )}
    </form>
  );
}
