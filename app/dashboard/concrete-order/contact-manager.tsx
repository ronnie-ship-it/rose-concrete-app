"use client";

import { useActionState, useTransition } from "react";
import {
  saveContactAction,
  deleteContactAction,
  type ContactResult,
} from "./actions";
import { Card, PrimaryButton } from "@/components/ui";

type Contact = {
  id: string;
  name: string;
  phone: string;
  role: string | null;
  is_default: boolean;
};

export function ContactManager({ contacts }: { contacts: Contact[] }) {
  const [state, formAction, pending] = useActionState<
    ContactResult | null,
    FormData
  >(saveContactAction, null);
  const [isDeleting, startDelete] = useTransition();

  return (
    <div className="space-y-3">
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Default</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-4 text-center text-neutral-500"
                >
                  No contacts saved yet.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-2">{c.role ?? "—"}</td>
                  <td className="px-4 py-2">{c.is_default ? "Yes" : "No"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => {
                        if (confirm(`Remove ${c.name}?`)) {
                          startDelete(async () => {
                            await deleteContactAction(c.id);
                          });
                        }
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <form action={formAction} className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="block text-xs font-medium text-neutral-600">
              Name
            </span>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-neutral-600">
              Phone
            </span>
            <input
              name="phone"
              required
              placeholder="+16195551234"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-neutral-600">
              Role
            </span>
            <input
              name="role"
              placeholder="Driver / Dispatcher"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 md:pt-5">
            <input
              name="is_default"
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
            <span className="text-sm text-neutral-700">Default recipient</span>
          </label>
          <div className="md:col-span-4 flex justify-end gap-2">
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add contact"}
            </PrimaryButton>
          </div>
          {state?.ok === false && (
            <p className="md:col-span-4 text-sm text-red-600">{state.error}</p>
          )}
          {state?.ok === true && (
            <p className="md:col-span-4 text-sm text-emerald-700">Saved.</p>
          )}
        </form>
      </Card>
    </div>
  );
}

