"use client";

import { useActionState, useMemo, useState } from "react";
import { acceptQuoteAction } from "./actions";
import { money } from "@/lib/format";
import {
  computeForMethod,
  describeAchFee,
  describeCardFee,
  type FeeConfig,
  type PaymentMethod,
} from "@/lib/payments";

type OptionalItem = {
  id: string;
  title: string;
  description: string | null;
  line_total: number;
};

export function PublicQuoteForm({
  token,
  baseTotal,
  optional,
  depositPercent,
  depositAmountOverride,
  depositNonrefundable,
  warrantyMonths,
  balanceTerms,
  personalNote,
  alreadyAccepted,
  feeConfig,
}: {
  token: string;
  baseTotal: number;
  optional: OptionalItem[];
  depositPercent: number;
  depositAmountOverride: number | null;
  depositNonrefundable: boolean;
  warrantyMonths: number;
  balanceTerms: string | null;
  personalNote: string | null;
  alreadyAccepted: boolean;
  feeConfig: FeeConfig;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(optional.map((o) => [o.id, false])),
  );
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [state, formAction, pending] = useActionState(acceptQuoteAction, null);

  const optionalSelectedTotal = useMemo(
    () =>
      optional.reduce(
        (sum, o) => (selected[o.id] ? sum + o.line_total : sum),
        0,
      ),
    [selected, optional],
  );
  const grandTotal = baseTotal + optionalSelectedTotal;
  const depositDue =
    depositAmountOverride != null
      ? depositAmountOverride
      : Math.round(grandTotal * (depositPercent / 100) * 100) / 100;

  const selectedIdsCsv = optional
    .filter((o) => selected[o.id])
    .map((o) => o.id)
    .join(",");

  // Compute fees for all three methods off the current grand total. Updates
  // as the customer toggles optional add-ons above.
  const methodTotals = useMemo(() => {
    return {
      check: computeForMethod("check", grandTotal, feeConfig),
      ach: computeForMethod("ach", grandTotal, feeConfig),
      credit_card: computeForMethod("credit_card", grandTotal, feeConfig),
    };
  }, [grandTotal, feeConfig]);

  const chosenTotal = method ? methodTotals[method].total : null;

  return (
    <div className="space-y-8">
      {optional.length > 0 && !alreadyAccepted && (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {optional.map((o) => (
            <li key={o.id} className="px-4 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected[o.id] ?? false}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [o.id]: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-5 w-5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-neutral-900">{o.title}</p>
                    <p className="font-semibold text-neutral-900">
                      +{money(o.line_total)}
                    </p>
                  </div>
                  {o.description && (
                    <p className="mt-1 text-xs text-neutral-600">
                      {o.description}
                    </p>
                  )}
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-700">Base total</dt>
            <dd className="font-medium text-neutral-900">{money(baseTotal)}</dd>
          </div>
          {optional.length > 0 && (
            <div className="flex justify-between">
              <dt className="text-neutral-700">Selected add-ons</dt>
              <dd className="font-medium text-neutral-900">
                {money(optionalSelectedTotal)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base">
            <dt className="font-bold text-neutral-900">Job total</dt>
            <dd className="font-bold text-neutral-900">{money(grandTotal)}</dd>
          </div>
          <div className="flex justify-between text-sm text-neutral-600">
            <dt>Deposit ({depositPercent}%)</dt>
            <dd className="font-medium">{money(depositDue)}</dd>
          </div>
        </dl>
      </section>

      {!alreadyAccepted && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Choose your payment method
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Pick one below, then sign to accept. Your choice — and the
              total you&apos;ll pay — locks with your signature.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <PaymentOptionCard
              id="check"
              title="Check"
              tagline="No fee. Most popular."
              feeLabel="No fee"
              feeAmount={methodTotals.check.fee}
              total={methodTotals.check.total}
              base={grandTotal}
              selected={method === "check"}
              onSelect={() => setMethod("check")}
              subtitle="Drop off or mail a check. Ronnie confirms receipt."
            />
            <PaymentOptionCard
              id="ach"
              title="ACH bank transfer"
              tagline="Pay securely online."
              feeLabel={describeAchFee(feeConfig)}
              feeAmount={methodTotals.ach.fee}
              total={methodTotals.ach.total}
              base={grandTotal}
              selected={method === "ach"}
              onSelect={() => setMethod("ach")}
              subtitle="We email a QuickBooks bank-transfer link after you sign."
            />
            <PaymentOptionCard
              id="credit_card"
              title="Credit card"
              tagline="Fastest — any major card."
              feeLabel={describeCardFee(feeConfig)}
              feeAmount={methodTotals.credit_card.fee}
              total={methodTotals.credit_card.total}
              base={grandTotal}
              selected={method === "credit_card"}
              onSelect={() => setMethod("credit_card")}
              subtitle="We email a QuickBooks card link after you sign."
            />
          </div>
          {method && (
            <p className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
              You&apos;re paying{" "}
              <strong>{money(methodTotals[method].total)}</strong> total via{" "}
              {method === "credit_card"
                ? "credit card"
                : method === "ach"
                  ? "ACH bank transfer"
                  : "check"}
              . Scroll down to sign — the total locks with your signature.
            </p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-lg border-2 border-brand-200 bg-brand-50 p-5 text-sm text-neutral-800">
        <p>
          <strong className="text-brand-700">
            {warrantyMonths}-month warranty
          </strong>{" "}
          on all workmanship — best in San Diego.
        </p>
        {depositNonrefundable && (
          <p>
            <strong className="text-brand-700">
              Deposit is non-refundable
            </strong>{" "}
            and reserves your spot on the schedule. Once work begins, the
            deposit secures the materials and crew time committed to your
            project.
          </p>
        )}
        <p>{balanceTerms ?? "Balance due upon completion."}</p>
      </section>

      {personalNote && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm italic text-neutral-700">
          &quot;{personalNote}&quot;
          <p className="mt-2 not-italic text-xs text-neutral-500">
            — Ronnie Rose
          </p>
        </section>
      )}

      {!alreadyAccepted && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input
            type="hidden"
            name="selected_optional_ids"
            value={selectedIdsCsv}
          />
          <input
            type="hidden"
            name="payment_method"
            value={method ?? ""}
          />
          <div>
            <label
              htmlFor="signature"
              className="block text-sm font-medium text-neutral-700"
            >
              Type your full name to accept this quote
            </label>
            <input
              id="signature"
              name="signature"
              type="text"
              required
              placeholder="e.g. Jane Smith"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-2 text-xs text-neutral-500">
              By typing your name and clicking Accept, you agree to the scope,
              total, deposit terms, {warrantyMonths}-month warranty, and your
              selected payment method above. Your choice — method and total —
              locks with this signature and cannot be changed.
            </p>
          </div>
          {state && !state.ok && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !method}
            className="w-full rounded-md bg-brand-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Accepting…"
              : !method
                ? "Pick a payment method above"
                : `Accept & lock — ${money(chosenTotal ?? grandTotal)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function PaymentOptionCard({
  id,
  title,
  tagline,
  feeLabel,
  feeAmount,
  total,
  base,
  selected,
  onSelect,
  subtitle,
}: {
  id: string;
  title: string;
  tagline: string;
  feeLabel: string;
  feeAmount: number;
  total: number;
  base: number;
  selected: boolean;
  onSelect: () => void;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex h-full flex-col rounded-lg border p-4 text-left transition ${
        selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500"
          : "border-neutral-300 bg-white hover:border-brand-300 hover:bg-brand-50/40"
      }`}
      data-option-id={id}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <p className="text-xs font-medium text-neutral-600">{tagline}</p>
        </div>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            selected
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-neutral-300 bg-white text-transparent"
          }`}
          aria-hidden="true"
        >
          {selected ? "✓" : ""}
        </span>
      </div>
      <div className="mt-4 text-2xl font-bold text-neutral-900">
        {money(total)}
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-neutral-600">
        <div className="flex justify-between">
          <dt>Job amount</dt>
          <dd>{money(base)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{feeLabel}</dt>
          <dd>{feeAmount > 0 ? `+ ${money(feeAmount)}` : money(0)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-neutral-500">{subtitle}</p>
    </button>
  );
}
