import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPill } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { AutomationForm } from "./automation-form";
import { RuleToggle } from "./rule-toggle";

export const metadata = { title: "Automations — Rose Concrete" };

type Rule = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  is_enabled: boolean;
  conditions: Record<string, string | number | null>;
  actions: Array<{ kind: string }>;
  updated_at: string;
};

const TRIGGER_LABEL: Record<string, string> = {
  quote_approved: "Quote approved",
  quote_sent: "Quote sent",
  job_completed: "Job completed",
  invoice_paid: "Invoice paid",
  visit_scheduled: "Visit scheduled",
  visit_completed: "Visit completed",
  lead_captured: "Lead captured",
};

/**
 * Combined settings page:
 *   - Cadence + review URL for the built-in follow-up crons
 *     (quote follow-up / post-job follow-up).
 *   - User-configured rules engine: trigger + actions, toggle on/off.
 *
 * Editing the rule body (trigger, conditions, actions JSON) lives on
 * `/dashboard/settings/automations/[ruleId]` — this page surfaces the
 * list + toggle + last-run summary.
 */
export default async function AutomationsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: cfg }, { data: rulesRaw }, { data: recentRuns }] =
    await Promise.all([
      supabase.from("automation_config").select("*").limit(1).maybeSingle(),
      supabase
        .from("automation_rules")
        .select(
          "id, name, description, trigger, is_enabled, conditions, actions, updated_at",
        )
        .order("trigger", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("automation_rule_runs")
        .select("id, rule_id, trigger, entity_type, entity_id, status, summary, ran_at")
        .order("ran_at", { ascending: false })
        .limit(10),
    ]);

  const rules = (rulesRaw ?? []) as Rule[];
  const byTrigger = new Map<string, Rule[]>();
  for (const r of rules) {
    const list = byTrigger.get(r.trigger) ?? [];
    list.push(r);
    byTrigger.set(r.trigger, list);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Automations"
        subtitle="Rules that fire on business events + cadence knobs for the built-in follow-up crons."
      />

      {/* ─── Rules engine ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Rules
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Each rule runs when its trigger fires. Toggle off to pause.
            </p>
          </div>
          <Link
            href="/dashboard/settings/automations/new"
            className="inline-flex items-center justify-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New rule
          </Link>
        </div>
        {rules.length === 0 ? (
          <Card>
            <p className="text-sm text-neutral-500">
              No rules yet. Run{" "}
              <code>migrations/034_automation_rules.sql</code> to seed
              defaults, or click <strong>+ New rule</strong>.
            </p>
          </Card>
        ) : (
          Array.from(byTrigger.entries()).map(([trigger, list]) => (
            <div key={trigger}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                On {TRIGGER_LABEL[trigger] ?? trigger}
              </p>
              <Card className="p-0">
                <ul className="divide-y divide-neutral-100">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/settings/automations/${r.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {r.name}
                        </Link>
                        {r.description && (
                          <p className="mt-0.5 text-xs text-neutral-600">
                            {r.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {r.actions.length} action
                          {r.actions.length === 1 ? "" : "s"}:{" "}
                          {r.actions
                            .map((a) => a.kind.replace(/_/g, " "))
                            .join(", ")}
                          {Object.keys(r.conditions ?? {}).length > 0 &&
                            ` · filters: ${Object.entries(r.conditions)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(", ")}`}
                        </p>
                      </div>
                      <RuleToggle id={r.id} enabled={r.is_enabled} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))
        )}

        {(recentRuns ?? []).length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Recent runs
            </h3>
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Trigger</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentRuns ?? []).map((r: unknown) => {
                    const row = r as {
                      id: string;
                      trigger: string;
                      status: string;
                      summary: string | null;
                      ran_at: string;
                    };
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-3 py-2 text-xs text-neutral-500">
                          {dateShort(row.ran_at)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {TRIGGER_LABEL[row.trigger] ?? row.trigger}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill
                            status={row.status}
                            tone={
                              row.status === "ok"
                                ? "success"
                                : row.status === "skipped"
                                  ? "neutral"
                                  : "danger"
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-700">
                          {row.summary ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </section>

      {/* ─── Built-in follow-up cron cadence ───────────────────── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Follow-up cadence (built-in crons)
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Offsets in days. Quote cadence fires for quotes sitting in
          status=sent; post-job cadence fires after a project is marked done.
        </p>
        <AutomationForm
          initial={{
            quote_followup_first_days: cfg?.quote_followup_first_days ?? 3,
            quote_followup_second_days: cfg?.quote_followup_second_days ?? 7,
            quote_cold_after_days: cfg?.quote_cold_after_days ?? 14,
            postjob_thankyou_days: cfg?.postjob_thankyou_days ?? 0,
            postjob_review_days: cfg?.postjob_review_days ?? 3,
            postjob_checkin_days: cfg?.postjob_checkin_days ?? 30,
            review_url: cfg?.review_url ?? "",
          }}
        />
      </section>
    </div>
  );
}
