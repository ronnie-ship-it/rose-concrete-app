import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, dateShort } from "@/lib/format";
import { assignCostToProjectAction } from "../actions";

export const metadata = { title: "Unmatched costs — Rose Concrete" };

export default async function UnmatchedQueuePage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [costsRes, projectsRes] = await Promise.all([
    supabase
      .from("job_costs")
      .select(
        "id, amount, occurred_on, raw_customer, category, memo, match_source"
      )
      .is("project_id", null)
      .order("occurred_on", { ascending: false })
      .limit(200),
    supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .not("status", "in", "(done,cancelled)")
      .order("name"),
  ]);

  const costs = costsRes.data ?? [];
  const projects = (projectsRes.data ?? []).map((p) => {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    return {
      id: p.id as string,
      label: client?.name
        ? `${p.name} — ${client.name}`
        : (p.name as string),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings/qbo"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← QBO Job Costing
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Unmatched expenses
        </h1>
        <p className="text-sm text-neutral-600">
          These rows came in from QuickBooks but didn&apos;t match a project.
          Pick a project for each one — they&apos;ll be recorded as{" "}
          <span className="font-medium">manual</span> matches and won&apos;t be
          re-guessed on future imports.
        </p>
      </div>

      {costs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No unmatched costs. Good.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">QBO name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Memo</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Assign to project</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-700">
                    {dateShort(c.occurred_on as string)}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    {c.raw_customer ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{c.category ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-neutral-500">
                    {c.memo ?? ""}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-neutral-900">
                    {money(c.amount as number)}
                  </td>
                  <td className="px-4 py-2">
                    <form action={assignCostToProjectAction} className="flex gap-2">
                      <input type="hidden" name="cost_id" value={c.id as string} />
                      <select
                        name="project_id"
                        required
                        defaultValue=""
                        className="min-w-[14rem] rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Pick project…
                        </option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        Assign
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
