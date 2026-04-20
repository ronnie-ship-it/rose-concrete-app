"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { FeeConfig, PaymentMethod } from "@/lib/payments";
import {
  computeCardFee,
  computeCardTotal,
  formatUsd,
} from "@/lib/payments";
import { StatusPill } from "@/components/ui";
import {
  markMilestonePaid,
  markMilestoneUnpaid,
  toggleMilestoneReminders,
} from "./milestones-actions";

/**
 * Project-page view of the payment schedule. Lists each milestone with:
 *   - status pill + method the client picked (if any)
 *   - check amount + credit-card amount (so Ronnie always knows both)
 *   - "Copy pay link" → copies /pay/<token> to clipboard for texting
 *   - "Mark paid" / "Undo" for out-of-QBO reconciliation
 *   - QBO invoice link if the schedule is hooked up
 *
 * Read-only mirror of what the client sees at /pay/[token]; the fee math
 * comes from the shared `lib/payments.ts` helpers so numbers can't drift.
 */

export type MilestoneRow = {
  id: string;
  sequence: number;
  kind: "deposit" | "progress" | "final" | "custom";
  label: string;
  amount: number;
  due_date: string | null;
  status: string;
  payment_method: PaymentMethod | null;
  fee_amount: number;
  total_with_fee: number | null;
  pay_token: string;
  qbo_payment_id: string | null;
  qbo_paid_at: string | null;
  reminders_paused: boolean;
};

export function MilestonesSection({
  projectId,
  milestones,
  feeConfig,
  scheduleQboInvoiceId,
  scheduleQboInvoiceNumber,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  feeConfig: FeeConfig;
  scheduleQboInvoiceId: string | null;
  scheduleQboInvoiceNumber: string | null;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Payment schedule
          </h2>
          {scheduleQboInvoiceNumber && (
            <p className="mt-0.5 text-xs text-neutral-500">
              QBO invoice{" "}
              <span className="font-mono">{scheduleQboInvoiceNumber}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>
            {milestones.filter((m) => m.status === "paid").length} /{" "}
            {milestones.length} paid
          </span>
        </div>
      </div>

      <ul className="divide-y divide-neutral-100">
        {milestones.map((m) => (
          <MilestoneRowView
            key={m.id}
            projectId={projectId}
            milestone={m}
            feeConfig={feeConfig}
          />
        ))}
      </ul>
    </section>
  );
}

function MilestoneRowView({
  projectId,
  milestone,
  feeConfig,
}: {
  projectId: string;
  milestone: MilestoneRow;
  feeConfig: FeeConfig;
}) {
  const amount = Number(milestone.amount);
  const cardFee = computeCardFee(amount, feeConfig);
  const cardTotal = computeCardTotal(amount, feeConfig);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${milestone.pay_token}`
      : `/pay/${milestone.pay_token}`;

  function copyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(payUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function togglePaid() {
    setError(null);
    startTransition(async () => {
      const res =
        milestone.status === "paid"
          ? await markMilestoneUnpaid(projectId, milestone.id)
          : await markMilestonePaid(projectId, milestone.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">
              #{milestone.sequence}
            </span>
            <h3 className="text-sm font-semibold text-neutral-900">
              {milestone.label}
            </h3>
            <StatusPill status={milestone.status} />
            {milestone.payment_method && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                via {milestone.payment_method.replace("_", " ")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {milestone.due_date
              ? `Due ${milestone.due_date}`
              : "Due on completion"}
            {milestone.qbo_paid_at
              ? ` · paid ${new Date(milestone.qbo_paid_at).toLocaleDateString()}`
              : ""}
          </p>
        </div>

        <div className="text-right text-sm">
          <div className="text-xs text-neutral-500">
            Check {formatUsd(amount)}
          </div>
          <div className="font-semibold text-neutral-900">
            Card {formatUsd(cardTotal)}
          </div>
          {cardFee > 0 && (
            <div className="text-[11px] text-neutral-500">
              incl. {formatUsd(cardFee)} fee
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {copied ? "Copied ✓" : "Copy pay link"}
        </button>
        <Link
          href={`/pay/${milestone.pay_token}`}
          target="_blank"
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Preview ↗
        </Link>
        <button
          type="button"
          onClick={togglePaid}
          disabled={pending}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            milestone.status === "paid"
              ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending
            ? "Saving…"
            : milestone.status === "paid"
              ? "Undo paid"
              : "Mark paid"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await toggleMilestoneReminders(
                projectId,
                milestone.id,
                !milestone.reminders_paused
              );
              if (!res.ok) setError(res.error);
            });
          }}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          title={
            milestone.reminders_paused
              ? "Reminders are paused for this milestone"
              : "Pause the reminder cadence for this milestone"
          }
        >
          {milestone.reminders_paused ? "Resume reminders" : "Pause reminders"}
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </li>
  );
}
