"use client";

/**
 * Sidebar on the project page's Invoicing tab. Houses the Jobber
 * "Invoice settings" controls:
 *
 *   Online payment
 *     ☑ Card   ☑ ACH   ☐ Partial payments
 *
 *   Client view
 *     ☑ Show quantities    ☑ Show unit prices
 *     ☑ Show line totals   ☑ Show account balance
 *     ☑ Show late stamp
 *
 *   Signature
 *     ☐ Collect signature on acceptance
 *
 *   Delivery
 *     [ Mark as sent ]     — or —     Sent ✓ on {date}   [ Undo ]
 *
 * Checkboxes save optimistically on change; errors surface as a
 * small red note under the group.
 */
import { useState, useTransition } from "react";
import {
  setScheduleFlagAction,
  markScheduleSentAction,
  unmarkScheduleSentAction,
  type InvoiceSidebarKey,
} from "./invoice-sidebar-actions";

export type InvoiceSidebarState = {
  allow_card: boolean;
  allow_ach: boolean;
  allow_partial: boolean;
  show_quantities: boolean;
  show_unit_price: boolean;
  show_line_totals: boolean;
  show_account_balance: boolean;
  show_late_stamp: boolean;
  require_signature: boolean;
  sent_at: string | null;
  sent_channel: string | null;
};

export function InvoiceSidebar({
  projectId,
  initial,
}: {
  projectId: string;
  initial: InvoiceSidebarState;
}) {
  const [state, setState] = useState<InvoiceSidebarState>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(key: InvoiceSidebarKey) {
    setError(null);
    const next = !state[key];
    setState((prev) => ({ ...prev, [key]: next })); // optimistic
    start(async () => {
      const res = await setScheduleFlagAction(projectId, key, next);
      if (!res.ok) {
        // Revert on failure.
        setState((prev) => ({ ...prev, [key]: !next }));
        setError(res.error);
      }
    });
  }

  function markSent() {
    setError(null);
    const now = new Date().toISOString();
    setState((prev) => ({ ...prev, sent_at: now, sent_channel: "manual" }));
    start(async () => {
      const res = await markScheduleSentAction(projectId, "manual");
      if (!res.ok) {
        setState((prev) => ({ ...prev, sent_at: null, sent_channel: null }));
        setError(res.error);
      }
    });
  }

  function undoSent() {
    setError(null);
    const prevSent = state.sent_at;
    const prevCh = state.sent_channel;
    setState((prev) => ({ ...prev, sent_at: null, sent_channel: null }));
    start(async () => {
      const res = await unmarkScheduleSentAction(projectId);
      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          sent_at: prevSent,
          sent_channel: prevCh,
        }));
        setError(res.error);
      }
    });
  }

  return (
    <aside className="space-y-5 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Online payment
        </h3>
        <div className="mt-2 space-y-1.5 text-sm">
          <Checkbox
            label="Credit / debit card"
            checked={state.allow_card}
            onToggle={() => toggle("allow_card")}
            disabled={pending}
          />
          <Checkbox
            label="ACH bank transfer"
            checked={state.allow_ach}
            onToggle={() => toggle("allow_ach")}
            disabled={pending}
          />
          <Checkbox
            label="Allow partial payments"
            checked={state.allow_partial}
            onToggle={() => toggle("allow_partial")}
            disabled={pending}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Client view
        </h3>
        <p className="mt-1 text-[11px] text-neutral-500">
          Hide columns from the public invoice to mask markups.
        </p>
        <div className="mt-2 space-y-1.5 text-sm">
          <Checkbox
            label="Show quantities"
            checked={state.show_quantities}
            onToggle={() => toggle("show_quantities")}
            disabled={pending}
          />
          <Checkbox
            label="Show unit prices"
            checked={state.show_unit_price}
            onToggle={() => toggle("show_unit_price")}
            disabled={pending}
          />
          <Checkbox
            label="Show line-item totals"
            checked={state.show_line_totals}
            onToggle={() => toggle("show_line_totals")}
            disabled={pending}
          />
          <Checkbox
            label="Show account balance"
            checked={state.show_account_balance}
            onToggle={() => toggle("show_account_balance")}
            disabled={pending}
          />
          <Checkbox
            label="Show late stamp"
            checked={state.show_late_stamp}
            onToggle={() => toggle("show_late_stamp")}
            disabled={pending}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Signature
        </h3>
        <div className="mt-2 space-y-1.5 text-sm">
          <Checkbox
            label="Collect signature at payment"
            checked={state.require_signature}
            onToggle={() => toggle("require_signature")}
            disabled={pending}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Delivery
        </h3>
        {state.sent_at ? (
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-emerald-700">
              ✓ Marked sent{" "}
              {new Date(state.sent_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {state.sent_channel && state.sent_channel !== "manual" && (
                <span className="text-neutral-500"> · via {state.sent_channel}</span>
              )}
            </p>
            <button
              type="button"
              onClick={undoSent}
              disabled={pending}
              className="text-[11px] text-neutral-500 underline disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={markSent}
            disabled={pending}
            className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Mark as sent
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </aside>
  );
}

function Checkbox({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-neutral-700">{label}</span>
    </label>
  );
}
