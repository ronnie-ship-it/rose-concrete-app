"use client";

import { useTransition, useState } from "react";
import {
  updateMemberRoleAction,
  updateMemberNameAction,
  removeMemberAction,
} from "./actions";
import { Card } from "@/components/ui";

type Role = "admin" | "office" | "crew";
type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

export function TeamTable({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function setRole(id: string, role: Role) {
    setErr(null);
    start(async () => {
      const res = await updateMemberRoleAction(id, role);
      if (!res.ok) setErr(res.error);
    });
  }
  function setName(id: string, name: string) {
    setErr(null);
    start(async () => {
      const res = await updateMemberNameAction(id, name);
      if (!res.ok) setErr(res.error);
    });
  }
  function remove(id: string, label: string) {
    if (!confirm(`Remove ${label} from the team?`)) return;
    setErr(null);
    start(async () => {
      const res = await removeMemberAction(id);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <Card className="p-0">
      {err && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {err}
        </p>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                No team members yet.
              </td>
            </tr>
          )}
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            return (
              <tr
                key={m.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="px-4 py-2">
                  <input
                    defaultValue={m.full_name ?? ""}
                    placeholder="(no name)"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (m.full_name ?? "")) {
                        setName(m.id, e.target.value);
                      }
                    }}
                    className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2 text-xs text-neutral-700">
                  {m.email}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => setRole(m.id, e.target.value as Role)}
                    className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="office">Office</option>
                    <option value="crew">Crew</option>
                  </select>
                  {isSelf && (
                    <span className="ml-2 text-[11px] text-neutral-500">
                      (you)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!isSelf && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(m.id, m.full_name ?? m.email)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
