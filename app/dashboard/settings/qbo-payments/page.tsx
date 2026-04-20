import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { qboIsConfigured } from "@/lib/qbo/invoices";
import { PageHeader, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ToggleRow } from "./toggle-row";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "QuickBooks Payments — Rose Concrete" };

export default async function QboPaymentsSettingsPage() {
  await requireRole(["admin"]);
  const enabled = await isFeatureEnabled("qbo_auto_invoice");
  const wired = qboIsConfigured();
  const envName = (process.env.QBO_ENV ?? "").toLowerCase() === "sandbox"
    ? "Sandbox"
    : "Production";

  // Recent auto-invoice activity for eyeballing the pipeline.
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("activity_log")
    .select("id, action, created_at, payload, entity_id")
    .eq("entity_type", "project")
    .in("action", ["invoice_auto_created", "invoice_created"])
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-6">
      <PageHeader
        title="QuickBooks Payments"
        subtitle="Auto-create QBO invoices with the locked payment total the moment a customer signs. Customers pay via the QBO-hosted Pay Now link (check / ACH / card)."
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              QBO connection
            </h3>
            <p className="text-xs text-neutral-500">
              Environment: <strong>{envName}</strong>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              wired
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {wired ? "✓ Connected" : "Not connected"}
          </span>
        </div>
        {!wired && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Set these env vars in Vercel project settings, then redeploy:
            <ul className="mt-2 space-y-0.5 font-mono">
              <li>
                <code>QBO_ACCESS_TOKEN</code> — OAuth 2.0 access token
              </li>
              <li>
                <code>QBO_REALM_ID</code> — company id from Intuit
              </li>
              <li>
                <code>QBO_ENV</code> — <code>sandbox</code> or{" "}
                <code>production</code> (default production)
              </li>
            </ul>
            <p className="mt-2">
              Until the token is present, the adapter silently falls back to
              a mock invoice number so the app keeps working offline. Once
              set, the next quote accept fires a real QBO invoice.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <ToggleRow enabled={enabled} />
        <div className="mt-3 space-y-1 text-xs text-neutral-500">
          <p>
            When on, accepting a quote at <code>/q/&lt;token&gt;</code>{" "}
            triggers:
          </p>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>
              Payment schedule seeded from the locked total (deposit +
              final).
            </li>
            <li>
              QBO customer lookup/create by client name; email copied over
              when available.
            </li>
            <li>
              QBO invoice created with one line per milestone, total =
              signed total.
            </li>
            <li>
              Online Payment toggles flipped on for the methods the customer
              picked (check stays off, ACH/card on).
            </li>
          </ol>
          <p>Check the activity log below to confirm each accept fired.</p>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent invoice activity
        </h2>
        <Card className="p-0">
          {(recent ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              No invoices generated yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Trigger</th>
                  <th className="px-4 py-2">QBO #</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Project</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((r: unknown) => {
                  const row = r as {
                    id: string;
                    action: string;
                    created_at: string;
                    entity_id: string;
                    payload:
                      | {
                          qbo_invoice_number?: string;
                          invoice_total?: number;
                          pay_now_url?: string | null;
                          milestone_count?: number;
                        }
                      | null;
                  };
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-2 text-neutral-500">
                        {dateShort(row.created_at)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {row.action === "invoice_auto_created"
                          ? "Quote accept"
                          : "Manual"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {row.payload?.qbo_invoice_number ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.payload?.invoice_total != null
                          ? money(row.payload.invoice_total)
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/dashboard/projects/${row.entity_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}
