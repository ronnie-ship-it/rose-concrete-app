import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { OrderForm } from "./order-form";
import { ContactManager } from "./contact-manager";

export const metadata = { title: "Concrete order — Rose Concrete" };

export default async function ConcreteOrderPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [{ data: contacts }, { data: projects }, { data: recent }] = await Promise.all([
    supabase
      .from("concrete_order_contacts")
      .select("id, name, phone, role, is_default, sort_order")
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name, service_address, status, client:clients(name)")
      .in("status", ["approved", "scheduled", "active"])
      .order("scheduled_start", { ascending: true })
      .limit(40),
    supabase
      .from("concrete_orders")
      .select(
        "id, pour_date, pour_time, yards, psi, status, sent_at, recipients, project:projects(name, client:clients(name))",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type RawProject = {
    id: string;
    name: string;
    service_address: string | null;
    status: string;
    client: { name: string }[] | { name: string } | null;
  };
  const projectOptions = ((projects ?? []) as RawProject[]).map((p) => {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    return {
      id: p.id,
      name: p.name,
      address: p.service_address,
      client_name: client?.name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Concrete order"
        subtitle="Group text Willy, Roger, and Michael (or whoever you pick) with pour details. Saves a record + fans out via OpenPhone."
      />

      <OrderForm
        contacts={contacts ?? []}
        projects={projectOptions}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Default recipients
        </h2>
        <ContactManager contacts={contacts ?? []} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent orders
        </h2>
        <Card className="p-0">
          {(recent ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              No orders sent yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Pour date</th>
                  <th className="px-4 py-2">Project</th>
                  <th className="px-4 py-2">Yards</th>
                  <th className="px-4 py-2">PSI</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((r: unknown) => {
                  const row = r as {
                    id: string;
                    pour_date: string | null;
                    yards: number | null;
                    psi: string | null;
                    status: string;
                    sent_at: string | null;
                    project:
                      | {
                          name: string;
                          client: { name: string }[] | { name: string } | null;
                        }[]
                      | {
                          name: string;
                          client: { name: string }[] | { name: string } | null;
                        }
                      | null;
                  };
                  const p = Array.isArray(row.project) ? row.project[0] : row.project;
                  const c = p
                    ? Array.isArray(p.client)
                      ? p.client[0]
                      : p.client
                    : null;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-2">{row.pour_date ?? "—"}</td>
                      <td className="px-4 py-2">
                        {p?.name ?? "—"}
                        {c?.name && (
                          <span className="ml-1 text-xs text-neutral-500">
                            · {c.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{row.yards ?? "—"}</td>
                      <td className="px-4 py-2">{row.psi ?? "—"}</td>
                      <td className="px-4 py-2 capitalize">{row.status}</td>
                      <td className="px-4 py-2 text-neutral-500">
                        {row.sent_at ? dateShort(row.sent_at) : "—"}
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
