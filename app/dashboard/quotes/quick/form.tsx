"use client";

import { useActionState, useState } from "react";
import { ClientCombobox } from "@/components/client-combobox";
import {
  createQuickQuoteAction,
  type QuickQuoteResult,
} from "./actions";
import { SERVICE_TYPES, SERVICE_LABEL } from "@/lib/service-types";
import type { ClientSummary } from "@/app/actions/clients";

/**
 * Quick quote form. The only hard requirements are:
 *   - A client (picked from the combobox OR typed inline + phone/email)
 *   - A service address
 *
 * Everything else (service type, sqft, first line item, price) is
 * optional — the full quote editor handles refinement after submit.
 */
export function QuickQuoteForm() {
  const [state, formAction, pending] = useActionState<QuickQuoteResult, FormData>(
    createQuickQuoteAction,
    null,
  );
  // Auto-fill the client address / phone fields when a known client
  // is picked so Ronnie doesn't retype.
  const [picked, setPicked] = useState<ClientSummary | null>(null);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-6">
      <div className="sm:col-span-6">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Client
        </label>
        <div className="mt-1">
          <ClientCombobox
            name="client_id"
            onSelect={(c) => setPicked(c)}
            placeholder="Search by name, phone, or email — or + New client"
          />
        </div>
      </div>

      {/* When no existing client is picked, these three inputs let
          the action upsert a new one in-place. Hidden behind a
          conditional render once a client is picked. */}
      {!picked && (
        <>
          <div className="sm:col-span-6">
            <p className="text-[11px] text-neutral-500">
              Or fill these three and we&apos;ll create the client for you:
            </p>
          </div>
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
              New client name
            </label>
            <input
              name="client_name"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Phone
            </label>
            <input
              name="client_phone"
              type="tel"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="(619) 555-1234"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Email
            </label>
            <input
              name="client_email"
              type="email"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="jane@example.com"
            />
          </div>
        </>
      )}

      <div className="sm:col-span-6">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Service address <span className="text-red-600">*</span>
        </label>
        <input
          name="address"
          required
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="123 Main St, San Diego, CA 92103"
        />
      </div>

      <div className="sm:col-span-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Service type
        </label>
        <select
          name="service_type"
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="">— Pick one —</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Sqft (optional)
        </label>
        <input
          name="sqft"
          type="number"
          min="0"
          step="1"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="e.g. 850"
        />
      </div>

      <div className="sm:col-span-6">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Scope / first line (optional)
        </label>
        <textarea
          name="scope"
          rows={3}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Demo existing, prep, pour 4&quot; slab, broom finish"
        />
      </div>

      <div className="sm:col-span-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Starting price (optional)
        </label>
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          placeholder="e.g. 8500"
        />
      </div>

      {state && !state.ok && (
        <div className="sm:col-span-6">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        </div>
      )}

      <div className="sm:col-span-6 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create quote →"}
        </button>
      </div>
    </form>
  );
}
