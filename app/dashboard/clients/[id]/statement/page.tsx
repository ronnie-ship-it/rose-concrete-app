import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, dateShort } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = { title: "Statement — Rose Concrete" };

/**
 * Printable client statement. Given a client id and optional `from` /
 * `to` ISO-date query params (defaults to "current month"), renders a
 * clean black-and-white HTML document with every milestone + payment
 * activity in the window. Browser's "Save as PDF" turns it into the
 * deliverable Ronnie emails to the client.
 */
export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const { from: fromQ, to: toQ } = await searchParams;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, phone, address, city, state, postal_code")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  const { data: profile } = await supabase
    .from("business_profile")
    .select(
      "company_name, phone, email, website, address_line_1, city, state, postal_code, license_number",
    )
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const defaultFrom = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);
  const defaultTo = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  )
    .toISOString()
    .slice(0, 10);
  const fromDate = (fromQ ?? defaultFrom).slice(0, 10);
  const toDate = (toQ ?? defaultTo).slice(0, 10);

  // Pull every milestone on every project for this client, filtered to
  // the window by either due_date or qbo_paid_at.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, service_address")
    .eq("client_id", id);
  const projectIds = (projects ?? []).map((p) => p.id);

  const { data: milestones } =
    projectIds.length > 0
      ? await supabase
          .from("payment_milestones")
          .select(
            "id, label, amount, total_with_fee, qbo_paid_amount, qbo_paid_at, status, due_date, payment_method, schedule:payment_schedules!inner(project_id)",
          )
          .in("schedule.project_id", projectIds)
      : { data: [] as Array<{
          id: string;
          label: string;
          amount: number | string;
          total_with_fee: number | string | null;
          qbo_paid_amount: number | string | null;
          qbo_paid_at: string | null;
          status: string;
          due_date: string | null;
          payment_method: string | null;
          schedule: { project_id: string } | { project_id: string }[];
        }> };

  type M = {
    id: string;
    label: string;
    amount: number | string;
    total_with_fee: number | string | null;
    qbo_paid_amount: number | string | null;
    qbo_paid_at: string | null;
    status: string;
    due_date: string | null;
    payment_method: string | null;
    schedule:
      | { project_id: string }
      | { project_id: string }[];
  };
  const all = (milestones ?? []) as M[];
  const projectById = new Map(
    (projects ?? []).map((p) => [p.id, p]),
  );
  const inWindow = all.filter((m) => {
    const d = m.qbo_paid_at ?? m.due_date;
    if (!d) return false;
    const day = d.slice(0, 10);
    return day >= fromDate && day <= toDate;
  });

  const invoicedTotal = inWindow.reduce(
    (sum, m) => sum + Number(m.total_with_fee ?? m.amount ?? 0),
    0,
  );
  const paidTotal = inWindow
    .filter((m) => m.status === "paid")
    .reduce(
      (sum, m) =>
        sum + Number(m.qbo_paid_amount ?? m.total_with_fee ?? m.amount ?? 0),
      0,
    );
  const outstanding = Math.max(0, invoicedTotal - paidTotal);

  const clientAddressLines = [
    client.address,
    [client.city, client.state].filter(Boolean).join(", "),
    client.postal_code,
  ]
    .filter(Boolean)
    .map((s) => String(s));

  return (
    <div className="statement mx-auto max-w-3xl bg-white p-8 text-neutral-900">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          .statement { padding: 0 !important; }
        }
        .statement table { width: 100%; border-collapse: collapse; }
        .statement th, .statement td { padding: 6px 8px; text-align: left; }
        .statement th { border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
        .statement td { border-bottom: 1px solid #f3f3f3; font-size: 13px; }
        .statement .right { text-align: right; }
        .statement .totals td { font-weight: 600; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          <a
            href={`/dashboard/clients/${id}`}
            className="text-brand-700 hover:underline"
          >
            ← Back to client
          </a>
        </p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">
            {profile?.company_name ?? "Rose Concrete"}
          </h1>
          {profile?.address_line_1 && (
            <p className="text-xs text-neutral-600">
              {profile.address_line_1}
              {profile.city && `, ${profile.city}`}
              {profile.state && `, ${profile.state}`}
              {profile.postal_code && ` ${profile.postal_code}`}
            </p>
          )}
          <p className="text-xs text-neutral-600">
            {profile?.phone ?? ""} · {profile?.email ?? ""}
            {profile?.license_number && ` · Lic #${profile.license_number}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase tracking-wide">
            Statement
          </p>
          <p className="text-xs text-neutral-600">
            {dateShort(fromDate)} — {dateShort(toDate)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Issued {dateShort(new Date())}
          </p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-neutral-500">Billed to</p>
          <p className="font-semibold">{client.name}</p>
          {clientAddressLines.map((l, i) => (
            <p key={i} className="text-xs text-neutral-600">
              {l}
            </p>
          ))}
          {client.phone && (
            <p className="text-xs text-neutral-600">{client.phone}</p>
          )}
          {client.email && (
            <p className="text-xs text-neutral-600">{client.email}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-neutral-500">Summary</p>
          <table className="mt-1 text-right text-xs">
            <tbody>
              <tr>
                <td className="pr-2 text-neutral-600">Invoiced</td>
                <td className="font-semibold">{money(invoicedTotal)}</td>
              </tr>
              <tr>
                <td className="pr-2 text-neutral-600">Paid</td>
                <td className="font-semibold">{money(paidTotal)}</td>
              </tr>
              <tr>
                <td className="pr-2 text-neutral-600">Outstanding</td>
                <td
                  className={`font-semibold ${
                    outstanding > 0 ? "text-red-700" : ""
                  }`}
                >
                  {money(outstanding)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Description</th>
              <th>Status</th>
              <th className="right">Billed</th>
              <th className="right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {inWindow.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500">
                  No activity in this window.
                </td>
              </tr>
            )}
            {inWindow.map((m) => {
              const sched = Array.isArray(m.schedule)
                ? m.schedule[0]
                : m.schedule;
              const proj = sched
                ? projectById.get(sched.project_id)
                : undefined;
              const billed = Number(m.total_with_fee ?? m.amount ?? 0);
              const paid =
                m.status === "paid"
                  ? Number(
                      m.qbo_paid_amount ??
                        m.total_with_fee ??
                        m.amount ??
                        0,
                    )
                  : 0;
              const when = m.qbo_paid_at ?? m.due_date;
              return (
                <tr key={m.id}>
                  <td>{when ? dateShort(when) : "—"}</td>
                  <td>{proj?.name ?? "—"}</td>
                  <td>{m.label}</td>
                  <td className="capitalize">{m.status}</td>
                  <td className="right">{money(billed)}</td>
                  <td className="right">{paid > 0 ? money(paid) : "—"}</td>
                </tr>
              );
            })}
            <tr className="totals">
              <td colSpan={4} className="right">
                Totals
              </td>
              <td className="right">{money(invoicedTotal)}</td>
              <td className="right">{money(paidTotal)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="mt-6 text-xs text-neutral-500">
        Questions? Contact {profile?.phone ?? "the office"}
        {profile?.email ? ` · ${profile.email}` : ""}.
      </p>
    </div>
  );
}
