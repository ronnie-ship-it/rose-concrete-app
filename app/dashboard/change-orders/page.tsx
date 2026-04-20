import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPill } from "@/components/ui";
import { NewChangeOrderForm } from "./new-change-order-form";
import { dateShort, currencyShort } from "@/lib/format";

export const metadata = { title: "Change orders — Rose Concrete" };

type Row = {
  id: string;
  number: number;
  title: string;
  status: string;
  additional_cost: number;
  additional_days: number;
  signed_at: string | null;
  created_at: string;
  project: { id: string; name: string; client: { name: string } | null }[] | { id: string; name: string; client: { name: string } | null } | null;
};

export default async function ChangeOrdersPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [{ data: rowsRaw }, { data: projectsRaw }] = await Promise.all([
    supabase
      .from("change_orders")
      .select(
        "id, number, title, status, additional_cost, additional_days, signed_at, created_at, project:projects(id, name, client:clients(name))",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows = (rowsRaw ?? []) as unknown as Row[];
  const projectOptions = (projectsRaw ?? []).map((p: unknown) => {
    const proj = p as {
      id: string;
      name: string;
      client: { name: string }[] | { name: string } | null;
    };
    const client = Array.isArray(proj.client) ? proj.client[0] : proj.client;
    return {
      id: proj.id,
      name: proj.name,
      client_name: client?.name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change orders"
        subtitle="Mobile-friendly change orders with finger signature, photos, and a printable PDF."
      />

      <NewChangeOrderForm projects={projectOptions} />

      <Card className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            No change orders yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">+ Cost</th>
                <th className="px-4 py-2">+ Days</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Signed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = Array.isArray(r.project) ? r.project[0] : r.project;
                const c = p ? p.client : null;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs">#{r.number}</td>
                    <td className="px-4 py-2">{r.title}</td>
                    <td className="px-4 py-2">
                      {p?.name ?? "—"}
                      {c?.name && (
                        <span className="ml-1 text-xs text-neutral-500">
                          · {c.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {currencyShort(r.additional_cost)}
                    </td>
                    <td className="px-4 py-2">{r.additional_days}</td>
                    <td className="px-4 py-2">
                      <StatusPill
                        status={r.status}
                        tone={
                          r.status === "signed"
                            ? "success"
                            : r.status === "sent"
                              ? "info"
                              : r.status === "rejected"
                                ? "danger"
                                : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-neutral-500 text-xs">
                      {r.signed_at ? dateShort(r.signed_at) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/dashboard/change-orders/${r.id}`}
                        className="text-xs text-brand-700 hover:underline"
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
    </div>
  );
}
