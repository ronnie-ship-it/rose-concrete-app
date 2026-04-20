"use client";

import { useActionState, useRef, useEffect } from "react";
import { sendReplyAction, type ReplyResult } from "./actions";

export function ReplyForm({
  clientId,
  phone,
}: {
  clientId: string;
  phone: string | null;
}) {
  const bound = sendReplyAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    ReplyResult | null,
    FormData
  >(bound, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  if (!phone) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        This client doesn&apos;t have a phone number on file. Add one on
        their detail page to send SMS.
      </p>
    );
  }

  return (
    <form action={formAction} ref={ref} className="border-t border-neutral-100 pt-3">
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Reply via SMS…"
        className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 flex items-center justify-between">
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
