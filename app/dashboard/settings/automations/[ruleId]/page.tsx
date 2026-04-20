import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { RuleForm } from "../rule-form";

export const metadata = { title: "Automation rule — Rose Concrete" };

export default async function EditAutomationRulePage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  await requireRole(["admin"]);
  const { ruleId } = await params;
  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) notFound();

  const { data: runs } = await supabase
    .from("automation_rule_runs")
    .select(
      "id, trigger, entity_type, entity_id, status, summary, ran_at, actions_run",
    )
    .eq("rule_id", ruleId)
    .order("ran_at", { ascending: false })
    .limit(25);

  return (
    <div className="space-y-6">
      <PageHeader
        title={rule.name as string}
        subtitle={(rule.description as string) ?? "Edit this rule."}
        actions={
          <Link
            href="/dashboard/settings/automations"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All automations
          </Link>
        }
      />
      <Card>
        <RuleForm
          rule={{
            id: rule.id as string,
            name: rule.name as string,
            description: (rule.description as string | null) ?? null,
            trigger: rule.trigger as string,
            is_enabled: rule.is_enabled as boolean,
            conditions: (rule.conditions as Record<
              string,
              string | number | null
            >) ?? {},
            actions:
              (rule.actions as Array<Record<string, unknown>>) ?? [],
          }}
        />
      </Card>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Last 25 runs
        </h3>
        {(runs ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-neutral-500">
              This rule hasn&apos;t fired yet.
            </p>
          </Card>
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).map((r: unknown) => {
                  const row = r as {
                    id: string;
                    entity_type: string;
                    entity_id: string;
                    status: string;
                    summary: string | null;
                    ran_at: string;
                    actions_run: Array<{
                      kind: string;
                      ok: boolean;
                      detail?: string;
                    }>;
                  };
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-100 align-top last:border-0"
                    >
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {dateShort(row.ran_at)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.entity_type}
                        <p className="font-mono text-[10px] text-neutral-400">
                          {row.entity_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            row.status === "ok"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.status === "skipped"
                                ? "bg-neutral-100 text-neutral-700"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <p className="text-neutral-700">{row.summary}</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {(row.actions_run ?? []).map((a, i) => (
                            <li
                              key={i}
                              className={
                                a.ok
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }
                            >
                              {a.ok ? "✓" : "✗"}{" "}
                              <code>{a.kind}</code>
                              {a.detail && ` — ${a.detail}`}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
