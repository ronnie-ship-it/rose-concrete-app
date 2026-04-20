import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money } from "@/lib/format";
import {
  PageHeader,
  JobCard,
  EmptyState,
  StatusPillLink,
} from "@/components/ui";

export const metadata = { title: "Payments — Rose Concrete" };

/**
 * Payments inbox — one row per milestone across all active schedules.
 * Default view: "needs attention" (pending + due + overdue), newest first.
 * Click through to the project; the detailed milestone view lives there.
 */

type SearchParams = Promise<{ status?: string }>;

const VIEW_STATUSES: Record<string, string[]> = {
  open: ["pending", "due", "overdue"],
  paid: ["paid"],
  all: [],
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { status } = await searchParams;
  const view = status && status in VIEW_STATUSES ? status : "open";
  const filterStatuses = VIEW_STATUSES[view];

  const supabase = await createClient();
  let builder = supabase
    .from("payment_milestones")
    .select(
      "id, sequence, kind, label, amount, due_date, status, payment_method, total_with_fee, schedule:payment_schedules!inner(id, project:projects!inner(id, name, client:clients(name)))"
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filterStatuses.length > 0) {
    builder = builder.in("status", filterStatuses);
  }

  const { data: milestones, error } = await builder;

  // Summary strip — Jobber's billing overview shows these three numbers.
  const [{ data: summaryOpen }, { data: summaryOverdue }, { data: summaryPaid30 }] =
    await Promise.all([
      supabase
        .from("payment_milestones")
        .select("amount, total_with_fee, status")
        .in("status", ["pending", "due", "overdue"]),
      supabase
        .from("payment_milestones")
        .select("amount, total_with_fee")
        .eq("status", "overdue"),
      supabase
        .from("payment_milestones")
        .select("qbo_paid_amount, amount, total_with_fee, qbo_paid_at")
        .eq("status", "paid")
        .gte(
          "qbo_paid_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);

  const openTotal = (summaryOpen ?? []).reduce(
    (sum, r) => sum + Number(r.total_with_fee ?? r.amount ?? 0),
    0,
  );
  const overdueTotal = (summaryOverdue ?? []).reduce(
    (sum, r) => sum + Number(r.total_with_fee ?? r.amount ?? 0),
    0,
  );
  const paid30Total = (summaryPaid30 ?? []).reduce(
    (sum, r) =>
      sum +
      Number(r.qbo_paid_amount ?? r.total_with_fee ?? r.amount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle={`${milestones?.length ?? 0} milestone${
          milestones?.length === 1 ? "" : "s"
        }`}
        actions={
          <Link
            href="/dashboard/payments/batch"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Batch invoice…
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Open" value={money(openTotal)} tone="neutral" />
        <SummaryCard
          label="Overdue"
          value={money(overdueTotal)}
          tone={overdueTotal > 0 ? "danger" : "neutral"}
        />
        <SummaryCard
          label="Collected (30d)"
          value={money(paid30Total)}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["open", "paid", "all"] as const).map((v) => (
          <StatusPillLink
            key={v}
            href={`/dashboard/payments${v === "open" ? "" : `?status=${v}`}`}
            active={view === v}
            label={v}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {milestones && milestones.length > 0 ? (
        <div className="grid gap-2">
          {milestones.map((m) => {
            const schedule = Array.isArray(m.schedule)
              ? m.schedule[0]
              : m.schedule;
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
            const meta = [
              m.due_date ? `Due ${m.due_date}` : "Due on completion",
              m.payment_method ? `via ${m.payment_method.replace("_", " ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <JobCard
                key={m.id}
                href={`/dashboard/projects/${project?.id ?? ""}`}
                title={`${m.label} — ${project?.name ?? "Unknown project"}`}
                client={client?.name}
                meta={meta}
                status={m.status}
                right={
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      {money(m.total_with_fee ?? m.amount)}
                    </div>
                    {m.total_with_fee && Number(m.total_with_fee) !== Number(m.amount) && (
                      <div className="text-xs text-neutral-500">
                        from {money(m.amount)}
                      </div>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            view === "open" ? "No open milestones" : "Nothing to show"
          }
          description={
            view === "open"
              ? "Approved jobs auto-seed a deposit + balance. Approve a quote to see one here."
              : "Try a different filter."
          }
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${toneCls} p-4`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
