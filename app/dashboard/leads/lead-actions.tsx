"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  setLeadStatusAction,
  convertLeadToClientAction,
} from "./actions";

type Status = "new" | "contacted" | "qualified" | "converted" | "lost";

const NEXT: Record<Status, Status | null> = {
  new: "contacted",
  contacted: "qualified",
  qualified: "converted",
  converted: null,
  lost: null,
};

export function LeadActions({
  leadId,
  status,
  hasClient,
  clientId,
}: {
  leadId: string;
  status: Status;
  hasClient: boolean;
  clientId: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function flipTo(next: Status) {
    setErr(null);
    start(async () => {
      const res = await setLeadStatusAction(leadId, next);
      if (!res.ok) setErr(res.error);
      router.refresh();
    });
  }

  function convert() {
    setErr(null);
    start(async () => {
      const res = await convertLeadToClientAction(leadId);
      if (!res.ok) {
        setErr(res.error);
      } else if ("clientId" in res) {
        router.push(`/dashboard/clients/${res.clientId}`);
      } else {
        router.refresh();
      }
    });
  }

  const nextStatus = NEXT[status];
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
          status === "converted"
            ? "bg-emerald-100 text-emerald-800"
            : status === "lost"
              ? "bg-neutral-200 text-neutral-700"
              : status === "qualified"
                ? "bg-sky-100 text-sky-800"
                : status === "contacted"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-brand-100 text-brand-800"
        }`}
      >
        {status}
      </span>
      <div className="flex flex-wrap justify-end gap-1">
        {status !== "converted" && !hasClient && (
          <button
            type="button"
            disabled={pending}
            onClick={convert}
            className="rounded bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            Convert → client
          </button>
        )}
        {clientId && (
          <Link
            href={`/dashboard/clients/${clientId}`}
            className="rounded border border-brand-300 bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700"
          >
            Open client
          </Link>
        )}
        {nextStatus && (
          <button
            type="button"
            disabled={pending}
            onClick={() => flipTo(nextStatus)}
            className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            → {nextStatus}
          </button>
        )}
        {status !== "lost" && status !== "converted" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => flipTo("lost")}
            className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-60"
          >
            Lost
          </button>
        )}
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
