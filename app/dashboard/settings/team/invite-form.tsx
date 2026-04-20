"use client";

import { useActionState } from "react";
import { inviteMemberAction, type TeamResult } from "./actions";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<
    TeamResult | null,
    FormData
  >(inviteMemberAction, null);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_1fr_160px_140px]">
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="them@example.com"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Full name
        </span>
        <input
          name="full_name"
          placeholder="Jane Doe"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Role
        </span>
        <select
          name="role"
          defaultValue="crew"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="crew">Crew</option>
          <option value="office">Office</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      {state?.ok === true && (
        <p className="md:col-span-4 text-sm text-emerald-700">
          Invite sent. They&apos;ll get a magic link in their email.
        </p>
      )}
      {state?.ok === false && (
        <p className="md:col-span-4 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
