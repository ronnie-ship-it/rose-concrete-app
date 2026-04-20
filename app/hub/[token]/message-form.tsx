"use client";

import { useActionState, useRef, useEffect } from "react";
import { sendHubMessageAction, type HubActionResult } from "./actions";

export function HubMessageForm({ token }: { token: string }) {
  const bound = sendHubMessageAction.bind(null, token);
  const [state, formAction, pending] = useActionState<
    HubActionResult | null,
    FormData
  >(bound, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form action={formAction} ref={ref} className="space-y-2">
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Type a message to the Rose Concrete team…"
        className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="flex items-center justify-between">
        {state?.ok === false ? (
          <p className="text-xs text-red-700">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-xs text-emerald-700">Sent ✓</p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
