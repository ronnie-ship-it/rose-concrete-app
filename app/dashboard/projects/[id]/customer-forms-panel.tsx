"use client";

/**
 * Project-page panel for the three customer forms. Each row shows
 * the form's status (draft / sent / completed), and — for office —
 * Send by Email / Send by SMS buttons, plus a "Copy link" helper.
 *
 * `demo_ack` gets a subtle amber flag when the project's
 * `demo_ack_required` is true and the form isn't completed yet.
 */
import { useState, useTransition } from "react";
import {
  sendDemoAckAction,
  sendPrePourAction,
  sendCompletionAction,
} from "./customer-form-actions";
import type { CustomerFormKind } from "@/lib/customer-forms";

export type CustomerFormSummary = {
  id: string;
  kind: CustomerFormKind;
  status: "draft" | "sent" | "completed" | "expired";
  token: string;
  sent_at: string | null;
  sent_via: string | null;
  completed_at: string | null;
};

export function CustomerFormsPanel({
  projectId,
  forms,
  demoAckRequired,
  demoAckAt,
  origin,
}: {
  projectId: string;
  forms: CustomerFormSummary[];
  demoAckRequired: boolean;
  demoAckAt: string | null;
  /** Public origin so copy-link produces an absolute URL. */
  origin: string;
}) {
  const rows = [
    {
      kind: "demo_ack" as const,
      label: "Pre-demo welcome + disclaimer",
      action: sendDemoAckAction,
      blurb:
        "Welcome video + acknowledgments of irrigation / gas / trees / cracks. Required before the job moves to active.",
    },
    {
      kind: "pre_pour" as const,
      label: "Pre-pour inspection",
      action: sendPrePourAction,
      blurb:
        "Mix / pattern / finish / color confirm. Auto-creates a concrete-order task when signed.",
    },
    {
      kind: "completion" as const,
      label: "Completion sign-off",
      action: sendCompletionAction,
      blurb:
        "Satisfaction + signature on finished work. Triggers the final invoice flow when signed.",
    },
  ];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Customer forms
      </h2>
      {demoAckRequired && !demoAckAt && (
        <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
          ⚠ Demo acknowledgment required before moving job to active.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {rows.map((r) => {
          const form = forms.find((f) => f.kind === r.kind);
          return (
            <FormRow
              key={r.kind}
              projectId={projectId}
              row={r}
              form={form}
              origin={origin}
            />
          );
        })}
      </ul>
    </section>
  );
}

function FormRow({
  projectId,
  row,
  form,
  origin,
}: {
  projectId: string;
  row: {
    kind: CustomerFormKind;
    label: string;
    blurb: string;
    action: (
      id: string,
      channel: "email" | "sms",
    ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  };
  form: CustomerFormSummary | undefined;
  origin: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const badge =
    form?.status === "completed"
      ? { label: "✓ Signed", cls: "bg-emerald-100 text-emerald-800" }
      : form?.status === "sent"
        ? { label: "Sent", cls: "bg-sky-100 text-sky-800" }
        : { label: "Not sent", cls: "bg-neutral-100 text-neutral-700" };

  function send(channel: "email" | "sms") {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await row.action(projectId, channel);
      if (res.ok) setMsg(`✓ Sent via ${channel}`);
      else setErr(res.error);
    });
  }

  function copyLink() {
    if (!form?.token) return;
    const url = `${origin}/forms/${form.token}`;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <li className="rounded-md border border-neutral-100 bg-white p-3 dark:border-brand-700 dark:bg-brand-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {row.label}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {row.blurb}
          </p>
          {form?.completed_at && (
            <p className="mt-1 text-[11px] text-emerald-700">
              Signed {new Date(form.completed_at).toLocaleDateString()}
            </p>
          )}
          {form?.sent_at && form.status !== "completed" && (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Sent {new Date(form.sent_at).toLocaleDateString()} ·{" "}
              {form.sent_via ?? "—"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => send("email")}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
          >
            Email
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => send("sms")}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
          >
            SMS
          </button>
          {form?.token && (
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          )}
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </li>
  );
}
