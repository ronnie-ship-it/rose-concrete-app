"use client";

import { useState } from "react";

export function PrintButton() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().setDate(1))
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  return (
    <div className="flex items-end gap-2">
      <label className="text-xs">
        <span className="block text-neutral-500">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
      <label className="text-xs">
        <span className="block text-neutral-500">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          const url = `${window.location.pathname}?from=${from}&to=${to}`;
          window.location.href = url;
        }}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
      >
        Apply range
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
