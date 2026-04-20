"use client";

import { useTransition } from "react";
import {
  deleteWatchedSenderAction,
  toggleWatchedSenderAction,
} from "./actions";
import { Card } from "@/components/ui";

type Sender = {
  id: string;
  email: string;
  label: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

export function WatchList({ senders }: { senders: Sender[] }) {
  const [pending, start] = useTransition();
  if (senders.length === 0) {
    return (
      <Card>
        <p className="text-sm text-neutral-500">No watched senders yet.</p>
      </Card>
    );
  }
  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Label</th>
            <th className="px-4 py-2">Note</th>
            <th className="px-4 py-2">Active</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {senders.map((s) => (
            <tr key={s.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{s.email}</td>
              <td className="px-4 py-2">{s.label ?? "—"}</td>
              <td className="px-4 py-2">{s.note ?? "—"}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      await toggleWatchedSenderAction(s.id, !s.is_active);
                    });
                  }}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.is_active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {s.is_active ? "On" : "Off"}
                </button>
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove ${s.email}?`)) {
                      start(async () => {
                        await deleteWatchedSenderAction(s.id);
                      });
                    }
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
