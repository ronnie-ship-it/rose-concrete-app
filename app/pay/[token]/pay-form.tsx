"use client";

import { useState, useTransition } from "react";
import type { FeeConfig, PaymentMethod } from "@/lib/payments";
import { PaymentMilestoneCard } from "@/components/payment-milestone-card";
import { selectPaymentMethod, submitPaymentSignatureAction } from "./actions";
import { SignaturePad, type SignatureData } from "@/components/signature-pad";

/**
 * Client-side interactive wrapper around PaymentMilestoneCard. The card
 * renders both options (check / credit card); this form lets the client
 * pick one, POST the choice back to the server action, and show a
 * confirmation. The server writes payment_method + fee_amount +
 * total_with_fee to the milestone row so the QBO invoice can be generated
 * with the correct amount.
 */

type Method = PaymentMethod;

export function PayForm({
  token,
  amount,
  feeConfig,
  checkInstructions,
  milestoneLabel,
  milestoneSequence,
  milestoneStatus,
  milestoneKind,
  dueDate,
  alreadyChosen,
  allowCard = true,
  allowAch = true,
  requireSignature = false,
  clientName = null,
}: {
  token: string;
  amount: number;
  feeConfig: FeeConfig;
  checkInstructions: string | null;
  milestoneLabel: string;
  milestoneSequence: number;
  milestoneStatus: string;
  milestoneKind: "deposit" | "progress" | "final" | "custom";
  dueDate: string | null;
  alreadyChosen: Method | null;
  allowCard?: boolean;
  allowAch?: boolean;
  requireSignature?: boolean;
  clientName?: string | null;
}) {
  const [chosen, setChosen] = useState<Method | null>(alreadyChosen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Signature state — only relevant when require_signature is set.
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [sigSaved, setSigSaved] = useState(false);

  function pick(method: Method) {
    setError(null);
    // Gate — if the schedule requires a signature, the customer can't
    // pick a method until they've drawn one.
    if (requireSignature && !sigSaved) {
      setError("Please sign above before selecting a payment method.");
      return;
    }
    startTransition(async () => {
      const res = await selectPaymentMethod(token, method);
      if (res.ok) {
        setChosen(method);
      } else {
        setError(res.error ?? "Could not save your selection.");
      }
    });
  }

  function saveSignature() {
    setError(null);
    if (!signature || !signature.pngDataUrl || !signature.name) {
      setError("Type your name and draw your signature before saving.");
      return;
    }
    startTransition(async () => {
      // Default scope is per-milestone — each milestone a customer pays
      // gets its own signature row. Schedule-level signatures are a
      // separate flow (quote acceptance), not this one.
      const res = await submitPaymentSignatureAction(
        token,
        signature.name,
        signature.pngDataUrl,
        "milestone",
      );
      if (res.ok) setSigSaved(true);
      else setError(res.error ?? "Could not save signature.");
    });
  }

  return (
    <div className="space-y-5">
      <PaymentMilestoneCard
        milestone={{
          id: token,
          sequence: milestoneSequence,
          kind: milestoneKind,
          label: milestoneLabel,
          amount,
          due_date: dueDate,
          status: milestoneStatus,
          payment_method: chosen,
          fee_amount: 0,
          total_with_fee: null,
        }}
        feeConfig={feeConfig}
        checkInstructions={checkInstructions ?? undefined}
      />

      {requireSignature && !chosen && !sigSaved && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            Sign to authorize this payment
          </p>
          <SignaturePad
            onChange={setSignature}
            initialName={clientName ?? ""}
          />
          <button
            type="button"
            onClick={saveSignature}
            disabled={pending || !signature?.pngDataUrl || !signature?.name}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save signature"}
          </button>
        </div>
      )}
      {requireSignature && sigSaved && !chosen && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          ✓ Signature saved — pick a payment method below.
        </div>
      )}

      {!chosen && (
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => pick("check")}
            disabled={pending || (requireSignature && !sigSaved)}
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pay by check
          </button>
          {allowAch && (
            <button
              type="button"
              onClick={() => pick("ach")}
              disabled={pending || (requireSignature && !sigSaved)}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pay by ACH
            </button>
          )}
          {allowCard && (
            <button
              type="button"
              onClick={() => pick("credit_card")}
              disabled={pending || (requireSignature && !sigSaved)}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pay by credit card
            </button>
          )}
        </div>
      )}

      {chosen && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">
            Thanks —{" "}
            {chosen === "check"
              ? "check"
              : chosen === "ach"
                ? "ACH bank transfer"
                : "credit card"}{" "}
            selected.
          </p>
          <p className="mt-1">
            {chosen === "check"
              ? checkInstructions ??
                "Make checks payable to Rose Concrete. Ronnie will confirm receipt once it arrives."
              : chosen === "ach"
                ? "We'll email a secure bank-transfer link from QuickBooks shortly. The fee on this milestone has been added to the total."
                : "We'll email a secure credit-card link from QuickBooks shortly. Your card will be charged the total shown above — that covers the milestone plus the processor's fee."}
          </p>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="mt-3 text-xs text-emerald-800 underline hover:text-emerald-900"
          >
            Change selection
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
