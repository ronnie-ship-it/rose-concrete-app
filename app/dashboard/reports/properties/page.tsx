import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Properties — Rose Concrete" };

/**
 * Properties report. Flat list of every service property across the
 * system with the number of projects tied to each. Two sources feed it:
 *   - `client_properties` — explicit multi-property records.
 *   - `projects.service_address` — the simple case, one address per job.
 *
 * Clicking a row opens the owning client.
 */
export default async function PropertiesReport() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [propsRes, projectsRes] = await Promise.all([
    supabase
      .from("client_properties")
      .select(
        "id, label, address, city, state, postal_code, client_id, client:clients(name)",
      )
      .order("city", { ascending: true })
      .limit(1000),
    supabase
      .from("projects")
      .select(
        "id, service_address, client_id, status, client:clients(name)",
      )
      .not("service_address", "is", null)
      .limit(2000),
  ]);

  type Prop = {
    id: string;
    label: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    client_id: string;
    client:
      | { name: string }
      | { name: string }[]
      | null;
  };
  type Proj = {
    id: string;
    service_address: string | null;
    client_id: string | null;
    status: string;
    client: { name: string } | { name: string }[] | null;
  };

  // Bucket projects by normalized address so the report can surface job
  // counts per property.
  function normAddr(a: string | null): string {
    if (!a) return "";
    return a
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[,.#]/g, "")
      .trim();
  }
  const jobsByAddr = new Map<string, { total: number; active: number }>();
  for (const p of (projectsRes.data ?? []) as Proj[]) {
    const k = normAddr(p.service_address);
    if (!k) continue;
    const entry = jobsByAddr.get(k) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (["approved", "scheduled", "active"].includes(p.status))
      entry.active += 1;
    jobsByAddr.set(k, entry);
  }

  // Explicit client_properties rows first.
  type Row = {
    id: string;
    label: string;
    address: string;
    client_name: string;
    client_id: string;
    jobCount: number;
    activeJobs: number;
    source: "property" | "project_only";
  };
  const explicit: Row[] = ((propsRes.data ?? []) as Prop[]).map((p) => {
    const c = Array.isArray(p.client) ? p.client[0] : p.client;
    const addrLine = [
      p.address,
      [p.city, p.state].filter(Boolean).join(", "),
      p.postal_code,
    ]
      .filter(Boolean)
      .join(" ");
    const key = normAddr(addrLine || p.label);
    const stats = jobsByAddr.get(key) ?? { total: 0, active: 0 };
    return {
      id: p.id,
      label: p.label,
      address: addrLine || p.label,
      client_name: c?.name ?? "—",
      client_id: p.client_id,
      jobCount: stats.total,
      activeJobs: stats.active,
      source: "property",
    };
  });

  // Synthesize rows from projects whose address has no explicit property
  // record. Dedupe by (client_id, normalized address).
  const seen = new Set(
    explicit.map((r) => `${r.client_id}::${normAddr(r.address)}`),
  );
  const synthesized: Row[] = [];
  for (const p of (projectsRes.data ?? []) as Proj[]) {
    if (!p.client_id || !p.service_address) continue;
    const k = `${p.client_id}::${normAddr(p.service_address)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const c = Array.isArray(p.client) ? p.client[0] : p.client;
    const stats = jobsByAddr.get(normAddr(p.service_address)) ?? {
      total: 1,
      active: 0,
    };
    synthesized.push({
      id: `synth::${p.id}`,
      label: "—",
      address: p.service_address,
      client_name: c?.name ?? "—",
      client_id: p.client_id,
      jobCount: stats.total,
      activeJobs: stats.active,
      source: "project_only",
    });
  }

  const rows = [...explicit, ...synthesized].sort((a, b) =>
    a.address.localeCompare(b.address),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle={`${rows.length} service location${rows.length === 1 ? "" : "s"} across every client.`}
        actions={
          <Link
            href="/dashboard/reports"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All reports
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No properties"
          description="Once a project ships with a service address, it'll populate this list."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2 text-right">Jobs</th>
                <th className="px-4 py-2 text-right">Active</th>
                <th className="px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2">
                    <a
                      href={`https://www.google.com/maps/?q=${encodeURIComponent(r.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {r.address}
                    </a>
                    {r.label !== "—" && r.label !== r.address && (
                      <p className="text-[11px] text-neutral-500">
                        {r.label}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/clients/${r.client_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{r.jobCount}</td>
                  <td className="px-4 py-2 text-right">{r.activeJobs}</td>
                  <td className="px-4 py-2 text-[11px] text-neutral-500">
                    {r.source === "property" ? "property" : "from project"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
