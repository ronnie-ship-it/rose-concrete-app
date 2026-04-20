import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { feeConfigFromRow, type FeeConfig } from "@/lib/payments";
import { PayForm } from "./pay-form";

export const metadata = {
  title: "Pay your Rose Concrete milestone",
  robots: { index: false },
};

type Params = Promise<{ token: string }>;

export default async function PublicPayPage({ params }: { params: Params }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // Single round trip: milestone + its schedule + project + client.
  const { data: milestone } = await supabase
    .from("payment_milestones")
    .select(
      "id, sequence, kind, label, amount, due_date, status, payment_method, fee_amount, total_with_fee, pay_token, schedule:payment_schedules!inner(id, allow_card, allow_ach, allow_partial, require_signature, show_account_balance, show_late_stamp, project:projects!inner(id, name, location, client:clients(id, name)))"
    )
    .eq("pay_token", token)
    .single();

  if (!milestone) notFound();

  const schedule = Array.isArray(milestone.schedule)
    ? milestone.schedule[0]
    : milestone.schedule;
  const project = schedule?.project
    ? Array.isArray(schedule.project)
      ? schedule.project[0]
      : schedule.project
    : null;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  // Fee config from invoice_settings (singleton row). Fall back to defaults
  // for any column that doesn't yet exist (pre-migration-024 databases).
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb, check_instructions",
    )
    .limit(1)
    .maybeSingle();

  const feeConfig: FeeConfig = feeConfigFromRow(settings);

  const alreadyPaid = milestone.status === "paid";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-neutral-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Rose Concrete · San Diego
        </p>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">
          Payment for {project?.name ?? "your project"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {client ? `Prepared for ${client.name} · ` : ""}
          {milestone.label}
          {milestone.due_date ? ` · Due ${milestone.due_date}` : ""}
        </p>
      </header>

      {alreadyPaid ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          <p className="font-semibold">Paid ✓</p>
          <p className="mt-1">
            Thanks — this milestone is marked paid in our books. A receipt
            should already be on its way to your email.
          </p>
        </div>
      ) : (
        <PayForm
          token={milestone.pay_token}
          amount={Number(milestone.amount)}
          feeConfig={feeConfig}
          checkInstructions={settings?.check_instructions ?? null}
          milestoneLabel={milestone.label}
          milestoneSequence={milestone.sequence}
          milestoneStatus={milestone.status}
          milestoneKind={milestone.kind}
          dueDate={milestone.due_date}
          alreadyChosen={milestone.payment_method}
          allowCard={schedule?.allow_card !== false}
          allowAch={schedule?.allow_ach !== false}
          requireSignature={schedule?.require_signature === true}
          clientName={client?.name ?? null}
        />
      )}

      <footer className="mt-10 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500">
        Rose Concrete · Licensed & insured · San Diego County
      </footer>
    </main>
  );
}
