"use client";

import { useState, useTransition } from "react";
import { signOffCashEntryAction } from "./actions";

/** Foreman-signed-off badge / toggle for each cash journal row. */
export function SignOffRow({
  id,
  signedAt,
}: {
  id: string;
  signedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<string | null>(signedAt);
  const [err, setErr] = useState<string | null>(null);

  if (local) {
    return (
      <span className="text-[11px] text-emerald-700">
        ✓ {new Date(local).toLocaleDateString()}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          start(async () => {
            const res = await signOffCashEntryAction(id);
            if (res.ok) setLocal(new Date().toISOString());
            else setErr(res.error);
          });
        }}
        className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
      >
        {pending ? "…" : "Sign off"}
      </button>
      {err && <span className="ml-1 text-[11px] text-red-700">{err}</span>}
    </>
  );
}
