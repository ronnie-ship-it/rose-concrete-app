import {
  computeForMethod,
  describeAchFee,
  describeCardFee,
  formatUsd,
  type FeeConfig,
  type PaymentMethod,
  DEFAULT_FEE_CONFIG,
} from "@/lib/payments";
import { StatusPill } from "@/components/ui";

/**
 * Renders a single payment milestone with all three payment options:
 *   - Check: exact milestone amount (no fee)
 *   - ACH bank transfer: amount + small flat/percent ACH fee
 *   - Credit card: amount + processing fee (gross-up so Ronnie still nets
 *     the full milestone amount)
 *
 * Used on the admin project page (read-only view of what the client sees)
 * and on the public pay page (where the client actually picks). Same
 * component on both so the numbers can't drift apart.
 */

export type MilestoneForDisplay = {
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
};

export function PaymentMilestoneCard({
  milestone,
  feeConfig = DEFAULT_FEE_CONFIG,
  checkInstructions,
}: {
  milestone: MilestoneForDisplay;
  feeConfig?: FeeConfig;
  checkInstructions?: string;
}) {
  const amount = Number(milestone.amount);
  const check = computeForMethod("check", amount, feeConfig);
  const ach = computeForMethod("ach", amount, feeConfig);
  const card = computeForMethod("credit_card", amount, feeConfig);
  const chosen = milestone.payment_method;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      {/* Header: label + status */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">
              Milestone {milestone.sequence}
            </span>
            <StatusPill status={milestone.status} />
          </div>
          <h3 className="mt-1 text-base font-semibold text-neutral-900">
            {milestone.label}
          </h3>
          {milestone.due_date ? (
            <p className="mt-0.5 text-xs text-neutral-500">
              Due {milestone.due_date}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-500">
              Due on completion
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Milestone amount
          </div>
          <div className="text-2xl font-semibold text-neutral-900">
            {formatUsd(amount)}
          </div>
        </div>
      </div>

      {/* Side-by-side payment options */}
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <PaymentOption
          title="Pay by check"
          badge="No fee"
          badgeTone="success"
          total={check.total}
          detail={
            <p className="text-xs text-neutral-500">
              {checkInstructions ??
                "Make checks payable to Rose Concrete."}
            </p>
          }
          selected={chosen === "check"}
        />
        <PaymentOption
          title="Pay by ACH"
          badge={describeAchFee(feeConfig)}
          badgeTone="info"
          total={ach.total}
          detail={
            ach.fee === 0 ? (
              <p className="text-xs text-neutral-500">
                No bank-transfer fee — Rose Concrete covers it.
              </p>
            ) : (
              <dl className="space-y-0.5 text-xs text-neutral-500">
                <div className="flex justify-between">
                  <dt>Milestone amount</dt>
                  <dd>{formatUsd(amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Bank-transfer fee</dt>
                  <dd>{formatUsd(ach.fee)}</dd>
                </div>
              </dl>
            )
          }
          selected={chosen === "ach"}
        />
        <PaymentOption
          title="Pay by credit card"
          badge={describeCardFee(feeConfig)}
          badgeTone="info"
          total={card.total}
          detail={
            feeConfig.cc_fee_absorb ? (
              <p className="text-xs text-neutral-500">
                No surcharge. Amount matches the milestone total.
              </p>
            ) : (
              <dl className="space-y-0.5 text-xs text-neutral-500">
                <div className="flex justify-between">
                  <dt>Milestone amount</dt>
                  <dd>{formatUsd(amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Processing fee</dt>
                  <dd>{formatUsd(card.fee)}</dd>
                </div>
              </dl>
            )
          }
          selected={chosen === "credit_card"}
        />
      </div>
    </div>
  );
}

function PaymentOption({
  title,
  badge,
  badgeTone,
  total,
  detail,
  selected,
}: {
  title: string;
  badge: string;
  badgeTone: "success" | "info";
  total: number;
  detail: React.ReactNode;
  selected: boolean;
}) {
  const toneCls =
    badgeTone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-sky-50 text-sky-700";
  const ringCls = selected
    ? "border-brand-500 ring-1 ring-brand-500"
    : "border-neutral-200";
  return (
    <div
      className={`flex flex-col rounded-md border ${ringCls} bg-white p-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneCls}`}
        >
          {badge}
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold text-neutral-900">
        {formatUsd(total)}
      </div>
      <div className="mt-2 flex-1">{detail}</div>
      {selected && (
        <div className="mt-3 text-xs font-medium text-brand-700">
          ✓ Client selected this option
        </div>
      )}
    </div>
  );
}
