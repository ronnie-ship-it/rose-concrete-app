import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import {
  computeForMethod,
  feeConfigFromRow,
  formatUsd,
} from "@/lib/payments";
import { InvoicingForm } from "./invoicing-form";

export const metadata = { title: "Invoicing — Rose Concrete" };

/**
 * Admin-only editor for the `invoice_settings` singleton.
 *
 * Live preview on the right shows what the client will see on a
 * hypothetical $10,000 quote for all three payment methods so Ronnie can
 * eyeball the fee before saving.
 */

export default async function InvoicingSettingsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb, check_instructions, updated_at",
    )
    .limit(1)
    .maybeSingle();

  const config = feeConfigFromRow(settings);

  // Preview: $10,000 sample (matches the UI language Ronnie sent).
  const sampleAmount = 10000;
  const check = computeForMethod("check", sampleAmount, config);
  const ach = computeForMethod("ach", sampleAmount, config);
  const card = computeForMethod("credit_card", sampleAmount, config);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoicing & payments"
        subtitle="Credit card + ACH processor fees and check instructions. Applies to every quote the client signs and every milestone on the pay page."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <InvoicingForm
              initial={{
                cc_fee_percent_display: (
                  config.cc_fee_percent * 100
                ).toString(),
                cc_fee_flat_cents: config.cc_fee_flat_cents,
                cc_fee_absorb: config.cc_fee_absorb,
                ach_fee_percent_display: (
                  config.ach_fee_percent * 100
                ).toString(),
                ach_fee_flat_cents: config.ach_fee_flat_cents,
                ach_fee_absorb: config.ach_fee_absorb,
                check_instructions:
                  settings?.check_instructions ??
                  "Make checks payable to Rose Concrete.",
              }}
            />
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Live preview · $10,000 quote
          </h2>
          <Card>
            <dl className="space-y-3 text-sm">
              <Row label="Check" amount={check.total} fee={check.fee} />
              <Row label="ACH" amount={ach.total} fee={ach.fee} />
              <Row label="Credit card" amount={card.total} fee={card.fee} />
            </dl>
            <p className="mt-3 text-xs text-neutral-500">
              Gross-up formula: <code>(amount + flat) / (1 − percent)</code>.
              Rose Concrete always nets the full {formatUsd(sampleAmount)} base
              after the processor takes their cut.
            </p>
          </Card>
          {settings?.updated_at && (
            <p className="text-xs text-neutral-500">
              Last updated {new Date(settings.updated_at).toLocaleString()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  amount,
  fee,
}: {
  label: string;
  amount: number;
  fee: number;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-neutral-100 pb-2 last:border-0">
      <div>
        <p className="font-semibold text-neutral-900">{label}</p>
        <p className="text-xs text-neutral-500">
          {fee > 0 ? `+ ${formatUsd(fee)} fee` : "No fee"}
        </p>
      </div>
      <p className="font-semibold text-neutral-900">{formatUsd(amount)}</p>
    </div>
  );
}
