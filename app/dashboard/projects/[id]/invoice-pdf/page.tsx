import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, dateShort } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Invoice — Rose Concrete",
  robots: { index: false },
};

/**
 * Printable invoice / signed-invoice PDF view for a single project's
 * payment schedule. Same browser-print-to-PDF approach as client
 * statements (no heavy PDF lib). Embeds every captured signature —
 * schedule-level (quote accept) and per-milestone — inline so Ronnie
 * can hand the customer (or the bookkeeper) a fully signed record.
 *
 * Respects the schedule's client-view toggles:
 *   - show_line_totals / show_account_balance / show_late_stamp are
 *     consulted here.
 *   - show_quantities / show_unit_price only apply when line items
 *     are present (future: when we render quote line items on the
 *     printed invoice).
 */
export default async function InvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, location, service_address, client:clients(id, name, email, phone, address, city, state, postal_code)",
    )
    .eq("id", id)
    .single();
  if (!project) notFound();

  const clientRel = Array.isArray(project.client)
    ? project.client[0]
    : project.client;

  const { data: schedule } = await supabase
    .from("payment_schedules")
    .select(
      "id, total_amount, qbo_invoice_number, allow_card, allow_ach, allow_partial, show_quantities, show_unit_price, show_line_totals, show_account_balance, show_late_stamp, require_signature, sent_at, sent_channel, created_at, milestones:payment_milestones(id, sequence, label, amount, total_with_fee, qbo_paid_amount, qbo_paid_at, status, due_date, payment_method, kind)",
    )
    .eq("project_id", id)
    .maybeSingle();

  if (!schedule) notFound();

  const { data: profile } = await supabase
    .from("business_profile")
    .select(
      "company_name, phone, email, website, address_line_1, city, state, postal_code, license_number",
    )
    .limit(1)
    .maybeSingle();

  const milestoneIds: string[] = (schedule.milestones ?? []).map(
    (m) => m.id as string,
  );

  // Signatures for this schedule + every milestone underneath it.
  const { data: signatures } =
    milestoneIds.length > 0
      ? await supabase
          .from("signatures")
          .select(
            "id, entity_type, entity_id, signer_name, png_data_url, captured_at",
          )
          .in("entity_type", ["payment_schedule", "payment_milestone"])
          .in("entity_id", [schedule.id as string, ...milestoneIds])
          .order("captured_at", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

  const milestoneLabelById = new Map<string, string>(
    (schedule.milestones ?? []).map((m) => [
      m.id as string,
      `#${m.sequence} · ${m.label as string}`,
    ]),
  );

  // Totals
  const ms = (schedule.milestones ?? [])
    .slice()
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  const invoicedTotal = ms.reduce(
    (sum, m) => sum + Number(m.total_with_fee ?? m.amount ?? 0),
    0,
  );
  const paidTotal = ms
    .filter((m) => m.status === "paid")
    .reduce(
      (sum, m) =>
        sum + Number(m.qbo_paid_amount ?? m.total_with_fee ?? m.amount ?? 0),
      0,
    );
  const outstanding = Math.max(0, invoicedTotal - paidTotal);

  // Late stamp — any unpaid milestone past due.
  const todayIso = new Date().toISOString().slice(0, 10);
  const anyLate = ms.some(
    (m) =>
      m.status !== "paid" &&
      m.due_date != null &&
      String(m.due_date).slice(0, 10) < todayIso,
  );

  const clientAddress = [
    clientRel?.address,
    [clientRel?.city, clientRel?.state].filter(Boolean).join(", "),
    clientRel?.postal_code,
  ]
    .filter(Boolean)
    .map((s) => String(s));

  return (
    <div className="invoice mx-auto max-w-3xl bg-white p-8 text-neutral-900">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          .invoice { padding: 0 !important; }
        }
        .invoice table { width: 100%; border-collapse: collapse; }
        .invoice th, .invoice td { padding: 6px 8px; text-align: left; }
        .invoice th { border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
        .invoice td { border-bottom: 1px solid #f3f3f3; font-size: 13px; }
        .invoice .right { text-align: right; }
        .invoice .totals td { font-weight: 600; }
        .invoice .sig-img { height: 70px; border: 1px solid #e5e5e5; border-radius: 4px; background: #fff; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <a
          href={`/dashboard/projects/${id}`}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Back to project
        </a>
        <PrintButton />
      </div>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {profile?.company_name ?? "Rose Concrete"}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Invoice</h1>
          {schedule.qbo_invoice_number && (
            <p className="text-xs text-neutral-500">
              QBO #{schedule.qbo_invoice_number}
            </p>
          )}
          {anyLate && schedule.show_late_stamp !== false && (
            <p className="mt-2 inline-block rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-700">
              Past Due
            </p>
          )}
        </div>
        <div className="text-right text-xs text-neutral-600">
          {profile?.address_line_1 && <div>{profile.address_line_1}</div>}
          {(profile?.city || profile?.state) && (
            <div>
              {[profile?.city, profile?.state].filter(Boolean).join(", ")}
              {profile?.postal_code ? ` ${profile.postal_code}` : ""}
            </div>
          )}
          {profile?.phone && <div>{profile.phone}</div>}
          {profile?.email && <div>{profile.email}</div>}
          {profile?.license_number && (
            <div>Lic. {profile.license_number}</div>
          )}
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wide text-neutral-500">
            Bill to
          </p>
          <p className="mt-1 text-sm font-semibold">{clientRel?.name}</p>
          {clientAddress.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {clientRel?.phone && <p>{clientRel.phone}</p>}
          {clientRel?.email && <p>{clientRel.email}</p>}
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-neutral-500">
            Project
          </p>
          <p className="mt-1 text-sm font-semibold">{project.name}</p>
          {project.service_address && <p>{project.service_address}</p>}
          {project.location && !project.service_address && (
            <p>{project.location}</p>
          )}
          <p className="mt-1 text-neutral-500">
            Issued{" "}
            {schedule.created_at
              ? dateShort(schedule.created_at)
              : "—"}
            {schedule.sent_at
              ? ` · Sent ${dateShort(schedule.sent_at)}`
              : ""}
          </p>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Milestones
        </h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Label</th>
              <th>Due</th>
              <th>Status</th>
              <th className="right">
                {schedule.show_line_totals !== false ? "Amount" : "Total"}
              </th>
            </tr>
          </thead>
          <tbody>
            {ms.map((m) => (
              <tr key={m.id as string}>
                <td>{String(m.sequence)}</td>
                <td>{m.label as string}</td>
                <td>{m.due_date ? String(m.due_date) : "On completion"}</td>
                <td>{m.status as string}</td>
                <td className="right">
                  {schedule.show_line_totals !== false
                    ? money(Number(m.total_with_fee ?? m.amount ?? 0))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {schedule.show_account_balance !== false && (
        <section className="mb-6">
          <table className="totals">
            <tbody>
              <tr>
                <td>Total invoiced</td>
                <td className="right">{money(invoicedTotal)}</td>
              </tr>
              <tr>
                <td>Paid to date</td>
                <td className="right">{money(paidTotal)}</td>
              </tr>
              <tr>
                <td>Outstanding balance</td>
                <td className="right">{money(outstanding)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {signatures && signatures.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Signatures
          </h2>
          <div className="space-y-3">
            {(signatures as Array<Record<string, unknown>>).map((s) => {
              const scope =
                (s.entity_type as string) === "payment_milestone"
                  ? milestoneLabelById.get(s.entity_id as string) ??
                    "Milestone"
                  : "Invoice";
              return (
                <div
                  key={s.id as string}
                  className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0"
                >
                  <div className="text-xs">
                    <p className="text-sm font-semibold">
                      {s.signer_name as string}
                    </p>
                    <p className="text-neutral-500">
                      {scope} · signed {dateShort(s.captured_at as string)}
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="sig-img"
                    src={s.png_data_url as string}
                    alt={`Signature of ${s.signer_name}`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="mt-10 border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-500">
        {profile?.company_name ?? "Rose Concrete"} · Thank you for your
        business.
      </footer>
    </div>
  );
}
