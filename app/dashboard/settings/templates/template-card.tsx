"use client";

import { useActionState, useState } from "react";
import { updateTemplateAction, type TemplateResult } from "./actions";

type Row = {
  slug: string;
  label: string;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  sms_body: string | null;
  send_email: boolean;
  send_sms: boolean;
  is_active: boolean;
  updated_at: string;
};

export function TemplateCard({ row }: { row: Row }) {
  const bound = updateTemplateAction.bind(null, row.slug);
  const [state, formAction, pending] = useActionState<
    TemplateResult | null,
    FormData
  >(bound, null);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{row.label}</p>
          {row.description && (
            <p className="mt-0.5 text-xs text-neutral-500">
              {row.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!row.is_active && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
              off
            </span>
          )}
          {row.send_email && row.email_subject && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">
              email
            </span>
          )}
          {row.send_sms && row.sms_body && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
              sms
            </span>
          )}
          <span className="text-neutral-400">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <form
          action={formAction}
          className="space-y-4 border-t border-neutral-100 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                <input
                  type="checkbox"
                  name="send_email"
                  defaultChecked={row.send_email}
                  className="h-4 w-4"
                />
                Send email
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Subject
                </span>
                <input
                  name="email_subject"
                  defaultValue={row.email_subject ?? ""}
                  className="mt-0.5 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Body
                </span>
                <textarea
                  name="email_body"
                  rows={8}
                  defaultValue={row.email_body ?? ""}
                  className="mt-0.5 w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
                />
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                <input
                  type="checkbox"
                  name="send_sms"
                  defaultChecked={row.send_sms}
                  className="h-4 w-4"
                />
                Send SMS
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  SMS body (plain text, ≤ 320 chars ideal)
                </span>
                <textarea
                  name="sms_body"
                  rows={6}
                  defaultValue={row.sms_body ?? ""}
                  className="mt-0.5 w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
                />
              </label>
              <p className="text-[11px] text-neutral-500">
                {(row.sms_body ?? "").length} chars ·{" "}
                {Math.ceil((row.sms_body ?? "").length / 160)} SMS segments
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={row.is_active}
                className="h-4 w-4"
              />
              Template is active
            </label>
            <div className="flex items-center gap-2">
              {state?.ok === true && (
                <span className="text-xs text-emerald-700">Saved ✓</span>
              )}
              {state?.ok === false && (
                <span className="text-xs text-red-600">{state.error}</span>
              )}
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
