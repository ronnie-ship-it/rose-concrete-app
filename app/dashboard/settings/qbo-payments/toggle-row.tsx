"use client";

import { useTransition, useState } from "react";
import { toggleAutoInvoiceAction } from "./actions";

export function ToggleRow({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function flip() {
    const next = !on;
    setOn(next);
    setErr(null);
    start(async () => {
      const res = await toggleAutoInvoiceAction(next);
      if (!res.ok) {
        setOn(!next);
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">
          Auto-invoice on quote accept
        </h3>
        <p className="text-xs text-neutral-500">
          <code>qbo_auto_invoice</code> feature flag
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={flip}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          on ? "bg-emerald-500" : "bg-neutral-300"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
