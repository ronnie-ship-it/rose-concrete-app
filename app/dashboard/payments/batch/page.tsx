import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { BatchInvoiceForm } from "./batch-form";

export const metadata = { title: "Batch invoicing — Rose Concrete" };

type Row = {
  id: string;
  name: string;
  status: string;
  completed_at: string | null;
  revenue_cached: number | string | null;
  client: { id: string; name: string } | { id: string; name: string }[] | null;
  schedule:
    | {
        id: string;
        qbo_invoice_id: string | null;
        qbo_invoice_number: string | null;
        milestones: Array<{
          id: string;
          amount: number | string;
          total_with_fee: number | string | null;
          status: string;
        }>;
      }
    | {
        id: string;
        qbo_invoice_id: string | null;
        qbo_invoice_number: string | null;
        milestones: Array<{
          id: string;
          amount: number | string;
          total_with_fee: number | string | null;
          status: string;
        }>;
      }[]
    | null;
};

export default async function BatchInvoicingPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // Candidates: projects that are done but have no qbo_invoice on their
  // schedule yet. That's Jobber's "Requires invoicing" bucket.
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, status, completed_at, revenue_cached, client:clients(id, name), schedule:payment_schedules(id, qbo_invoice_id, qbo_invoice_number, milestones:payment_milestones(id, amount, total_with_fee, status))",
    )
    .eq("status", "done")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
    const s = Array.isArray(r.schedule) ? r.schedule[0] : r.schedule;
    return !!s && !s.qbo_invoice_id;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch invoicing"
        subtitle="Pick done jobs that still need invoices generated — one click fires QBO invoices for every one."
        actions={
          <Link
            href="/dashboard/payments"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← Payments
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to invoice"
          description="Every completed job already has an invoice. Mark a project `done` to surface it here."
        />
      ) : (
        <Card>
          <BatchInvoiceForm
            candidates={rows.map((r) => {
              const sched = Array.isArray(r.schedule) ? r.schedule[0] : r.schedule;
              const ms = sched?.milestones ?? [];
              const total = ms.reduce(
                (sum, m) =>
                  sum + Number(m.total_with_fee ?? m.amount ?? 0),
                0,
              );
              const client = Array.isArray(r.client) ? r.client[0] : r.client;
              return {
                id: r.id,
                name: r.name,
                client_name: client?.name ?? "—",
                completed_at: r.completed_at,
                milestone_count: ms.length,
                total,
              };
            })}
          />
        </Card>
      )}
    </div>
  );
}

