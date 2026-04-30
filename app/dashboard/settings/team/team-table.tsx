"use client";

import { Fragment, useTransition, useState } from "react";
import {
  updateMemberRoleAction,
  updateMemberNameAction,
  removeMemberAction,
  setMemberPasswordAction,
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
  // Track which row's "Set password" mini-form is currently open.
  // Only one open at a time — saves screen real estate and matches
  // the "edit a single field" mental model the rest of the row uses.
  const [pwOpen, setPwOpen] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

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
  function setPassword(id: string, password: string, label: string) {
    setErr(null);
    setPwOk(null);
    start(async () => {
      const res = await setMemberPasswordAction(id, password);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setPwOk(`Password updated for ${label}.`);
      setPwOpen(null);
    });
  }

  return (
    <Card className="p-0">
      {err && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {err}
        </p>
      )}
      {pwOk && !err && (
        <p className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          {pwOk}
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
            const display = m.full_name?.trim() || m.email;
            return (
              <Fragment key={m.id}>
                <tr className="border-b border-neutral-100 last:border-0">
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
                  <td className="space-x-3 px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setPwOpen(pwOpen === m.id ? null : m.id)
                      }
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      {pwOpen === m.id ? "Cancel" : "Set password"}
                    </button>
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
                {pwOpen === m.id && (
                  <tr className="border-b border-neutral-100 bg-brand-50/40">
                    <td colSpan={4} className="px-4 py-3">
                      <PasswordRow
                        memberId={m.id}
                        memberLabel={display}
                        pending={pending}
                        onSubmit={setPassword}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/**
 * Inline mini-form that lets an admin set a new password for a team
 * member. We keep this strictly under the row that opened it so the
 * action stays visually anchored to the user it affects.
 *
 * The plaintext value never leaves the browser unencrypted; the
 * server action posts it to Supabase auth admin, which hashes
 * server-side. We don't echo the password back in the UI either —
 * once submitted, we close the row and surface a success banner.
 */
function PasswordRow({
  memberId,
  memberLabel,
  pending,
  onSubmit,
}: {
  memberId: string;
  memberLabel: string;
  pending: boolean;
  onSubmit: (id: string, password: string, label: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pw.length < 8) return;
        onSubmit(memberId, pw, memberLabel);
        setPw("");
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs font-semibold text-neutral-700">
        New password for {memberLabel}:
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
          autoFocus
          className="w-56 rounded border border-neutral-300 px-2 py-1 pr-12 text-xs"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-2 text-[10px] font-bold text-brand-700"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <button
        type="submit"
        disabled={pending || pw.length < 8}
        className="rounded bg-brand-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
      <p className="text-[11px] text-neutral-500">
        Share with {memberLabel} so they can log in via Password.
      </p>
    </form>
  );
}
