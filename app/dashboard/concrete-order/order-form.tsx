"use client";

import { useActionState, useMemo, useState } from "react";
import { sendConcreteOrderAction, type OrderActionResult } from "./actions";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";

type Contact = {
  id: string;
  name: string;
  phone: string;
  role: string | null;
  is_default: boolean;
};

type ProjectOption = {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
};

function composeDefaultMessage(fields: {
  projectLabel: string | null;
  pourDate: string;
  pourTime: string;
  yards: string;
  psi: string;
  slump: string;
  address: string;
  siteContact: string;
  sitePhone: string;
  mixNotes: string;
}): string {
  const lines = ["CONCRETE ORDER"];
  if (fields.projectLabel) lines.push(`Project: ${fields.projectLabel}`);
  if (fields.pourDate) {
    lines.push(
      `Pour: ${fields.pourDate}${fields.pourTime ? ` @ ${fields.pourTime}` : ""}`,
    );
  }
  if (fields.yards) lines.push(`Yards: ${fields.yards}`);
  if (fields.psi) lines.push(`PSI: ${fields.psi}`);
  if (fields.slump) lines.push(`Slump: ${fields.slump}`);
  if (fields.mixNotes) lines.push(`Mix: ${fields.mixNotes}`);
  if (fields.address) lines.push(`Address: ${fields.address}`);
  if (fields.siteContact || fields.sitePhone) {
    const contactParts = [fields.siteContact, fields.sitePhone]
      .filter(Boolean)
      .join(" ");
    if (contactParts) lines.push(`Site contact: ${contactParts}`);
  }
  lines.push("— Rose Concrete");
  return lines.join("\n");
}

export function OrderForm({
  contacts,
  projects,
}: {
  contacts: Contact[];
  projects: ProjectOption[];
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [pourDate, setPourDate] = useState("");
  const [pourTime, setPourTime] = useState("");
  const [yards, setYards] = useState("");
  const [psi, setPsi] = useState("3000");
  const [slump, setSlump] = useState("4");
  const [mixNotes, setMixNotes] = useState("");
  const [address, setAddress] = useState("");
  const [siteContact, setSiteContact] = useState("Ronnie");
  const [sitePhone, setSitePhone] = useState("");
  const defaultIds = useMemo(
    () => contacts.filter((c) => c.is_default).map((c) => c.id),
    [contacts],
  );
  const [recipientIds, setRecipientIds] = useState<string[]>(defaultIds);
  const [message, setMessage] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<
    OrderActionResult | null,
    FormData
  >(sendConcreteOrderAction, null);

  const selectedProject = projects.find((p) => p.id === projectId);
  const projectLabel = selectedProject
    ? `${selectedProject.name}${selectedProject.client_name ? ` (${selectedProject.client_name})` : ""}`
    : null;

  const autoAddress = selectedProject?.address ?? "";
  const addrToUse = address || autoAddress;

  const computed = useMemo(
    () =>
      composeDefaultMessage({
        projectLabel,
        pourDate,
        pourTime,
        yards,
        psi,
        slump,
        address: addrToUse,
        siteContact,
        sitePhone,
        mixNotes,
      }),
    [
      projectLabel,
      pourDate,
      pourTime,
      yards,
      psi,
      slump,
      addrToUse,
      siteContact,
      sitePhone,
      mixNotes,
    ],
  );
  const body = message ?? computed;

  function toggleRecipient(id: string) {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Card>
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Project (optional)
          </span>
          <select
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.client_name ? ` (${p.client_name})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Pour date
          </span>
          <input
            name="pour_date"
            type="date"
            value={pourDate}
            onChange={(e) => setPourDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Pour time
          </span>
          <input
            name="pour_time"
            type="time"
            value={pourTime}
            onChange={(e) => setPourTime(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Yards
          </span>
          <input
            name="yards"
            type="number"
            step="0.25"
            value={yards}
            onChange={(e) => setYards(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            PSI
          </span>
          <input
            name="psi"
            value={psi}
            onChange={(e) => setPsi(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Slump
          </span>
          <input
            name="slump"
            value={slump}
            onChange={(e) => setSlump(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Mix notes (fiber, air, color, etc.)
          </span>
          <input
            name="mix_notes"
            value={mixNotes}
            onChange={(e) => setMixNotes(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Delivery address
          </span>
          <input
            name="delivery_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={autoAddress || "Street, city, ZIP"}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Site contact
          </span>
          <input
            name="site_contact"
            value={siteContact}
            onChange={(e) => setSiteContact(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Site phone
          </span>
          <input
            name="site_phone"
            value={sitePhone}
            onChange={(e) => setSitePhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2 rounded border border-neutral-200 bg-neutral-50 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Recipients
          </h3>
          {contacts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No contacts saved yet. Add Willy / Roger / Michael below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => {
                const active = recipientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleRecipient(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-brand-600 bg-brand-50 text-brand-800"
                        : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    {c.name}
                    {c.role ? ` (${c.role})` : ""}
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="hidden"
            name="recipient_ids"
            value={recipientIds.join(",")}
          />
        </div>

        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Message preview (auto-composed — edit freely)
          </span>
          <textarea
            name="message_body"
            rows={7}
            value={body}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
          />
          <span className="mt-1 block text-[11px] text-neutral-500">
            {body.length} chars · ~{Math.ceil(body.length / 160)} SMS
          </span>
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-neutral-500">
            Orders save even when OpenPhone isn&apos;t wired. SMS silently
            no-ops until <code>OPENPHONE_API_KEY</code> is set.
          </div>
          <div className="flex gap-2">
            <SecondaryButton
              type="submit"
              name="send_now"
              value="0"
              disabled={pending}
            >
              Save draft
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              name="send_now"
              value="1"
              disabled={pending || recipientIds.length === 0}
            >
              {pending ? "Sending…" : "Send to group"}
            </PrimaryButton>
          </div>
        </div>
        {state && state.ok === true && (
          <p className="md:col-span-2 text-sm text-emerald-700">
            Saved. Sent: {state.sent}, failed: {state.failed}.
            {state.skipped ? " (OpenPhone not wired — saved as draft.)" : ""}
          </p>
        )}
        {state && state.ok === false && (
          <p className="md:col-span-2 text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </Card>
  );
}
