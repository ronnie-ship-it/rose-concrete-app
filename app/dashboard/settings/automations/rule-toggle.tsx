"use client";

import { useState, useTransition } from "react";
import { toggleRuleAction } from "./rule-actions";

export function RuleToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function flip() {
    const next = !on;
    setOn(next);
    setErr(null);
    start(async () => {
      const res = await toggleRuleAction(id, next);
      if (!res.ok) {
        setOn(!next);
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
