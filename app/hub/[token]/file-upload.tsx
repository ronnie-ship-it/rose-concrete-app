"use client";

import { useActionState, useRef, useEffect } from "react";
import { uploadHubFileAction, type HubActionResult } from "./actions";

export function HubFileUpload({ token }: { token: string }) {
  const bound = uploadHubFileAction.bind(null, token);
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
      <input
        type="file"
        name="file"
        required
        className="block w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs shadow-sm"
      />
      <p className="text-[11px] text-neutral-500">
        Photos, measurements, plans, permits — anything helpful for our crew.
      </p>
      <div className="flex items-center justify-between">
        {state?.ok === false ? (
          <p className="text-xs text-red-700">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-xs text-emerald-700">Uploaded ✓</p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
