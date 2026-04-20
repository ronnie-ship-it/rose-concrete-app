"use client";

import { useState, useTransition } from "react";
import { sendOnMyWayAction, type OnMyWayState } from "../actions";

/**
 * Big green "On my way" button on the visit detail page. Lets Ronnie /
 * office pick an ETA (default 20 min) and fire a pre-baked SMS to the
 * client through OpenPhone. Shows the server result inline so there's
 * no guessing about whether the message went out.
 */
export function OnMyWayButton({
  visitId,
  hasPhone,
}: {
  visitId: string;
  hasPhone: boolean;
}) {
  const [eta, setEta] = useState(20);
  const [state, setState] = useState<OnMyWayState>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await sendOnMyWayAction(visitId, eta);
      setState(res);
    });
  }

  if (!hasPhone) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        Add a phone number on this client to enable on-my-way texts.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-accent-200 bg-accent-50 p-3">
      <p className="text-sm font-semibold text-brand-700">On my way</p>
      <p className="mt-0.5 text-xs text-neutral-600">
        Fires a pre-written SMS to the client with your ETA.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-neutral-700">ETA</label>
        <select
          value={eta}
          onChange={(e) => setEta(Number(e.target.value))}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        >
          {[10, 15, 20, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? "Sending…" : "🚚  Send on-my-way text"}
        </button>
      </div>
      {state?.ok === true && (
        <p className="mt-2 text-xs font-medium text-brand-700">
          ✓ {state.message}
        </p>
      )}
      {state?.ok === false && (
        <p className="mt-2 text-xs font-medium text-red-700">{state.error}</p>
      )}
    </div>
  );
}
