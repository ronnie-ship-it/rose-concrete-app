"use client";

import { useTransition } from "react";
import { updateChangeOrderStatusAction } from "../actions";

export function StatusActions({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  const [pending, start] = useTransition();

  function flip(next: "draft" | "sent" | "signed" | "rejected") {
    start(async () => {
      await updateChangeOrderStatusAction(id, next);
    });
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {current !== "sent" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => flip("sent")}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Mark sent
        </button>
      )}
      {current !== "signed" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => flip("signed")}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100"
        >
          Mark signed
        </button>
      )}
      {current !== "rejected" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => flip("rejected")}
          className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
        >
          Rejected
        </button>
      )}
    </div>
  );
}
