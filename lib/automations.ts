/**
 * Automations rules engine — fires user-configured rules from
 * `automation_rules` in response to business-event triggers.
 *
 * Call `runAutomationsFor({ trigger, entity_type, entity_id, payload })`
 * from the server action where the event happens (e.g.
 * `acceptQuoteAction` calls it with trigger='quote_approved'). The
 * dispatcher:
 *   1. Loads enabled rules for that trigger
 *   2. Matches each rule's `conditions` against the payload (simple
 *      key/value equality — `{"service_type":"sidewalk"}` only fires
 *      when payload.service_type === 'sidewalk')
 *   3. Runs every matching rule's actions in sequence
 *   4. Writes an `automation_rule_runs` audit row per rule
 *
 * All actions are best-effort — a failed SMS never blocks a task. The
 * dispatcher returns a structured summary the caller can log but
 * shouldn't treat as fatal.
 *
 * Merge-token syntax for copy: `{first_name}`, `{project_name}`,
 * `{service_address}`, `{amount}`, `{pay_url}`, etc. Unknown tokens
 * pass through unchanged so Ronnie notices typos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { renderTemplate } from "@/lib/templates";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";
import { getEmailAdapter } from "@/lib/email";

export type AutomationTrigger =
  | "quote_approved"
  | "quote_sent"
  | "job_completed"
  | "invoice_paid"
  | "visit_scheduled"
  | "visit_completed"
  | "lead_captured";

export type AutomationAction =
  | { kind: "send_sms"; body: string; to?: "client" | "office" }
  | {
      kind: "send_email";
      to?: "client" | "office";
      subject: string;
      body: string;
    }
  | {
      kind: "create_task";
      title: string;
      body?: string;
      due_offset_days?: number;
      priority?: "low" | "normal" | "high" | "urgent";
    }
  | { kind: "move_status"; to: string }
  | { kind: "notify_office"; title: string; body?: string; link?: string };

export type AutomationPayload = Record<string, string | number | null | undefined>;

export type AutomationInput = {
  trigger: AutomationTrigger;
  entity_type: "quote" | "project" | "lead" | "visit" | "invoice";
  entity_id: string;
  /** Tokens available to copy / conditions. Include first_name,
   *  project_name, service_type, service_address, client_phone,
   *  client_email, amount, pay_url, quote_url, etc. */
  payload: AutomationPayload;
};

export type RuleRun = {
  rule_id: string;
  rule_name: string;
  status: "ok" | "skipped" | "error";
  summary: string;
  actions_run: Array<{
    kind: string;
    ok: boolean;
    detail?: string;
  }>;
};

type RuleRow = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  is_enabled: boolean;
  conditions: Record<string, string | number | null>;
  actions: AutomationAction[];
};

function matchesConditions(
  conditions: Record<string, string | number | null>,
  payload: AutomationPayload,
): boolean {
  for (const [k, v] of Object.entries(conditions ?? {})) {
    if (v == null) continue;
    const pv = payload[k];
    if (pv == null) return false;
    if (String(pv) !== String(v)) return false;
  }
  return true;
}

async function runAction(
  action: AutomationAction,
  input: AutomationInput,
  supabase: SupabaseClient,
): Promise<{ ok: boolean; detail?: string }> {
  try {
    const tokens = {
      ...input.payload,
      first_name:
        typeof input.payload.first_name === "string"
          ? input.payload.first_name
          : typeof input.payload.client_name === "string"
            ? (input.payload.client_name as string).split(/\s+/)[0]
            : "there",
    };

    switch (action.kind) {
      case "send_sms": {
        const dest =
          action.to === "office"
            ? (process.env.OFFICE_SMS_TO as string | undefined)
            : (input.payload.client_phone as string | undefined);
        const phone = dest ? normalizePhone(dest) : null;
        if (!phone) {
          return { ok: false, detail: "No phone on record." };
        }
        const body = renderTemplate(action.body, tokens);
        const res = await getOpenPhoneAdapter().sendMessage(phone, body);
        return {
          ok: res.ok,
          detail: res.ok ? "sms sent" : res.error,
        };
      }
      case "send_email": {
        const dest =
          action.to === "office"
            ? (process.env.LEAD_NOTIFICATION_EMAIL as string | undefined)
            : (input.payload.client_email as string | undefined);
        if (!dest) return { ok: false, detail: "No email on record." };
        const res = await getEmailAdapter().send({
          to: dest,
          subject: renderTemplate(action.subject, tokens),
          text: renderTemplate(action.body, tokens),
          tag: `automation:${input.trigger}`,
        });
        return {
          ok: res.ok,
          detail: res.ok ? "email sent" : res.error,
        };
      }
      case "create_task": {
        const due = action.due_offset_days
          ? new Date(
              Date.now() + action.due_offset_days * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null;
        const clientId = (input.payload.client_id as string | undefined) ?? null;
        const projectId =
          input.entity_type === "project"
            ? input.entity_id
            : (input.payload.project_id as string | undefined) ?? null;
        const { error } = await supabase.from("tasks").insert({
          title: renderTemplate(action.title, tokens),
          body: action.body ? renderTemplate(action.body, tokens) : null,
          status: "open",
          kanban_column: "todo",
          priority: action.priority ?? "normal",
          client_id: clientId,
          project_id: projectId,
          source: `automation:${input.trigger}`,
          due_at: due,
        });
        return {
          ok: !error,
          detail: error?.message ?? "task created",
        };
      }
      case "move_status": {
        const col =
          input.entity_type === "project"
            ? "status"
            : input.entity_type === "quote"
              ? "status"
              : null;
        if (!col) {
          return {
            ok: false,
            detail: `move_status not supported for ${input.entity_type}`,
          };
        }
        const { error } = await supabase
          .from(
            input.entity_type === "project"
              ? "projects"
              : "quotes",
          )
          .update({ [col]: action.to })
          .eq("id", input.entity_id);
        return {
          ok: !error,
          detail: error?.message ?? `moved to ${action.to}`,
        };
      }
      case "notify_office": {
        const { data: officers } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["admin", "office"]);
        const officeIds = (officers ?? []).map((o) => o.id as string);
        if (officeIds.length === 0) return { ok: true, detail: "no office users" };
        const renderedTitle = renderTemplate(action.title, tokens);
        const renderedBody = action.body ? renderTemplate(action.body, tokens) : null;
        // Consolidate in-app row + web push via lib/notify.
        const { notifyUsers } = await import("@/lib/notify");
        const res = await notifyUsers(
          {
            userIds: officeIds,
            kind: "system",
            title: renderedTitle,
            body: renderedBody,
            link: action.link ?? null,
            entity_type: input.entity_type,
            entity_id: input.entity_id,
          },
          supabase,
        );
        return {
          ok: true,
          detail: `notified ${res.inserted}${res.pushed ? `, pushed ${res.pushed}` : ""}`,
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "action threw",
    };
  }
}

/**
 * Primary entry point. Callers are server actions (acceptQuoteAction,
 * updateProjectAction, etc.). Never throws — best-effort by design.
 */
export async function runAutomationsFor(
  input: AutomationInput,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<RuleRun[]> {
  const results: RuleRun[] = [];
  try {
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("id, name, trigger, is_enabled, conditions, actions")
      .eq("trigger", input.trigger)
      .eq("is_enabled", true);
    const list = (rules ?? []) as RuleRow[];

    for (const rule of list) {
      if (!matchesConditions(rule.conditions ?? {}, input.payload)) {
        const run: RuleRun = {
          rule_id: rule.id,
          rule_name: rule.name,
          status: "skipped",
          summary: "conditions did not match",
          actions_run: [],
        };
        results.push(run);
        await supabase.from("automation_rule_runs").insert({
          rule_id: rule.id,
          trigger: input.trigger,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          status: "skipped",
          summary: run.summary,
          actions_run: [],
        });
        continue;
      }

      const actionsRun: RuleRun["actions_run"] = [];
      let anyError = false;
      for (const a of rule.actions ?? []) {
        const r = await runAction(a, input, supabase);
        actionsRun.push({
          kind: a.kind,
          ok: r.ok,
          detail: r.detail,
        });
        if (!r.ok) anyError = true;
      }

      const run: RuleRun = {
        rule_id: rule.id,
        rule_name: rule.name,
        status: anyError ? "error" : "ok",
        summary: `${actionsRun.filter((a) => a.ok).length}/${actionsRun.length} actions succeeded`,
        actions_run: actionsRun,
      };
      results.push(run);
      await supabase.from("automation_rule_runs").insert({
        rule_id: rule.id,
        trigger: input.trigger,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        status: run.status,
        summary: run.summary,
        actions_run: actionsRun,
      });
    }
  } catch (err) {
    console.error("[runAutomationsFor] dispatcher failed", err);
  }
  return results;
}
