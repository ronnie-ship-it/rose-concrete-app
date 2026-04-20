"use client";

import { useState, useTransition, useActionState } from "react";
import {
  upsertContactAction,
  deleteContactAction,
  type ContactResult,
} from "./properties-contacts-actions";

type Contact = {
  id: string;
  contact_type: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

function displayName(c: Contact): string {
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (n) return n;
  return c.email ?? c.phone ?? "Contact";
}

export function ContactsPanel({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Contact[];
}) {
  const [editing, setEditing] = useState<Contact | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Contacts
        </h2>
        {!addOpen && !editing && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Add
          </button>
        )}
      </div>

      {contacts.length === 0 && !addOpen ? (
        <p className="mt-2 text-xs text-neutral-500">
          No contacts yet. Add the spouse, property manager, billing
          contact, or anyone else who&apos;s in the loop.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              {editing?.id === c.id ? (
                <ContactForm
                  clientId={clientId}
                  initial={c}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-neutral-900">
                        {displayName(c)}
                      </p>
                      {c.is_primary && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                          Primary
                        </span>
                      )}
                      {c.contact_type && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
                          {c.contact_type}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-600">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="hover:underline">
                          📞 {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="hover:underline"
                        >
                          ✉ {c.email}
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="rounded px-2 py-0.5 text-[11px] text-brand-700 hover:bg-brand-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Remove ${displayName(c)}?`)) return;
                        start(async () => {
                          await deleteContactAction(clientId, c.id);
                        });
                      }}
                      className="rounded px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <div className="mt-3 rounded-md border border-dashed border-neutral-300 p-3">
          <ContactForm clientId={clientId} onDone={() => setAddOpen(false)} />
        </div>
      )}
    </div>
  );
}

function ContactForm({
  clientId,
  initial,
  onDone,
}: {
  clientId: string;
  initial?: Contact;
  onDone: () => void;
}) {
  const bound = upsertContactAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    ContactResult | null,
    FormData
  >(bound, null);

  if (state?.ok === true) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="grid gap-2 text-sm">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="block text-[11px] font-medium text-neutral-600">
            First name
          </span>
          <input
            name="first_name"
            defaultValue={initial?.first_name ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label>
          <span className="block text-[11px] font-medium text-neutral-600">
            Last name
          </span>
          <input
            name="last_name"
            defaultValue={initial?.last_name ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Role / type
        </span>
        <input
          name="contact_type"
          defaultValue={initial?.contact_type ?? ""}
          placeholder="Spouse / Billing / Property manager"
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="block text-[11px] font-medium text-neutral-600">
            Phone
          </span>
          <input
            name="phone"
            defaultValue={initial?.phone ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label>
          <span className="block text-[11px] font-medium text-neutral-600">
            Email
          </span>
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="is_primary"
          defaultChecked={initial?.is_primary}
          className="h-4 w-4"
        />
        Primary contact
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Notes
        </span>
        <input
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      {state?.ok === false && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
