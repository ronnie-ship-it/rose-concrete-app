"use client";

import { useActionState, useState, useTransition } from "react";
import {
  upsertRuleAction,
  deleteRuleAction,
  type RuleResult,
} from "./rule-actions";

type Rule = {
  id?: string;
  name: string;
  description: string | null;
  trigger: string;
  is_enabled: boolean;
  conditions: Record<string, string | number | null>;
  actions: Array<Record<string, unknown>>;
};

const TRIGGERS = [
  { key: "quote_approved", label: "Quote approved" },
  { key: "quote_sent", label: "Quote sent" },
  { key: "job_completed", label: "Job completed" },
  { key: "invoice_paid", label: "Invoice paid" },
  { key: "visit_scheduled", label: "Visit scheduled" },
  { key: "visit_completed", label: "Visit completed" },
  { key: "lead_captured", label: "Lead captured" },
];

export function RuleForm({ rule }: { rule: Rule }) {
  const [state, formAction, pending] = useActionState<
    RuleResult | null,
    FormData
  >(upsertRuleAction, null);
  const [deleting, startDelete] = useTransition();

  const [actions, setActions] = useState<string>(
    JSON.stringify(rule.actions ?? [], null, 2),
  );
  const [conditions, setConditions] = useState<string>(
    JSON.stringify(rule.conditions ?? {}, null, 2),
  );

  return (
    <form action={formAction} className="space-y-4">
      {rule.id && <input type="hidden" name="id" value={rule.id} />}
      <input type="hidden" name="actions" value={actions} />
      <input type="hidden" name="conditions" value={conditions} />

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Rule name
          </span>
          <input
            name="name"
            required
            defaultValue={rule.name}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Trigger
          </span>
          <select
            name="trigger"
            defaultValue={rule.trigger || "quote_approved"}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {TRIGGERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-neutral-600">
          Description
        </span>
        <input
          name="description"
          defaultValue={rule.description ?? ""}
          placeholder="What does this rule do in one line?"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_enabled"
          defaultChecked={rule.is_enabled}
          className="h-4 w-4"
        />
        <span className="font-medium text-neutral-800">Enabled</span>
      </label>

      <div className="space-y-2">
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600">
            Conditions (JSON object — empty = always fire)
          </span>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Simple key/value match against the event payload.
            Example: <code>{`{"service_type":"sidewalk"}`}</code>
          </p>
          <textarea
            rows={3}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-600">
            Actions (JSON array)
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                setActions(
                  JSON.stringify(
                    [
                      ...JSON.parse(actions || "[]"),
                      {
                        kind: "send_sms",
                        body: "Hi {first_name} — …",
                      },
                    ],
                    null,
                    2,
                  ),
                )
              }
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px]"
            >
              + SMS
            </button>
            <button
              type="button"
              onClick={() =>
                setActions(
                  JSON.stringify(
                    [
                      ...JSON.parse(actions || "[]"),
                      {
                        kind: "send_email",
                        subject: "…",
                        body: "Hi {first_name} — …",
                      },
                    ],
                    null,
                    2,
                  ),
                )
              }
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px]"
            >
              + Email
            </button>
            <button
              type="button"
              onClick={() =>
                setActions(
                  JSON.stringify(
                    [
                      ...JSON.parse(actions || "[]"),
                      {
                        kind: "create_task",
                        title: "Follow up with {client_name}",
                        due_offset_days: 1,
                        priority: "normal",
                      },
                    ],
                    null,
                    2,
                  ),
                )
              }
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px]"
            >
              + Task
            </button>
            <button
              type="button"
              onClick={() =>
                setActions(
                  JSON.stringify(
                    [
                      ...JSON.parse(actions || "[]"),
                      {
                        kind: "notify_office",
                        title: "…",
                        body: "…",
                      },
                    ],
                    null,
                    2,
                  ),
                )
              }
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px]"
            >
              + Notify office
            </button>
          </div>
        </div>
        <textarea
          rows={14}
          value={actions}
          onChange={(e) => setActions(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
        <p className="text-[11px] text-neutral-500">
          Tokens: <code>{`{first_name}`}</code>,{" "}
          <code>{`{client_name}`}</code>,{" "}
          <code>{`{project_name}`}</code>,{" "}
          <code>{`{service_address}`}</code>,{" "}
          <code>{`{service_type}`}</code>,{" "}
          <code>{`{amount}`}</code>
        </p>
      </div>

      {state?.ok === false && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {rule.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Delete rule "${rule.name}"?`)) return;
              startDelete(async () => {
                await deleteRuleAction(rule.id!);
              });
            }}
            className="mr-auto rounded-md border border-red-200 bg-white px-3 py-2 text-xs text-red-700"
          >
            Delete rule
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : rule.id ? "Save rule" : "Create rule"}
        </button>
      </div>
    </form>
  );
}
