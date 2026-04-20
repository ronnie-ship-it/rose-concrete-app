import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPillLink } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { LeadActions } from "./lead-actions";

export const metadata = { title: "Leads — Rose Concrete" };

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
] as const;

type Lead = {
  id: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  captured_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  service_address: string | null;
  service_type: string | null;
  message: string | null;
  title: string | null;
  requested_price: number | string | null;
  client_id: string | null;
  client: { id: string; name: string } | { id: string; name: string }[] | null;
};

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { status, q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  let builder = supabase
    .from("leads")
    .select(
      "id, source, status, captured_at, contact_name, contact_phone, contact_email, service_address, service_type, message, title, requested_price, client_id, client:clients(id, name)",
    )
    .order("captured_at", { ascending: false })
    .limit(200);
  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    builder = builder.eq("status", status);
  }
  if (query) {
    const pattern = `%${query}%`;
    builder = builder.or(
      `contact_name.ilike.${pattern},contact_phone.ilike.${pattern},contact_email.ilike.${pattern},service_address.ilike.${pattern},title.ilike.${pattern}`,
    );
  }
  const { data: rowsRaw } = await builder;
  const leads = (rowsRaw ?? []) as unknown as Lead[];

  // Per-status counts for the pills.
  const counts: Record<string, number> = {};
  for (const s of LEAD_STATUSES) counts[s] = 0;
  const { data: countRows } = await supabase.from("leads").select("status");
  for (const r of (countRows ?? []) as Array<{ status: string }>) {
    if (r.status in counts) counts[r.status]++;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} shown${query ? ` matching "${query}"` : ""}`}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <StatusPillLink
            href={
              query ? `/dashboard/leads?q=${encodeURIComponent(query)}` : "/dashboard/leads"
            }
            active={!status}
            label="All"
          />
          {LEAD_STATUSES.map((s) => {
            const params = new URLSearchParams();
            params.set("status", s);
            if (query) params.set("q", query);
            return (
              <StatusPillLink
                key={s}
                href={`/dashboard/leads?${params.toString()}`}
                active={status === s}
                label={s}
                count={counts[s]}
              />
            );
          })}
        </div>
        <form
          method="get"
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name, phone, email, address…"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
          {(query || status) && (
            <Link
              href="/dashboard/leads"
              className="px-2 text-sm text-neutral-500 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {leads.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            No leads match. Leads come from the public lead webhook
            (<code>/api/public/lead</code>), the <code>/book</code> page, or
            from OpenPhone unknown-number calls.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const client = Array.isArray(l.client) ? l.client[0] : l.client;
            const name =
              l.contact_name ??
              client?.name ??
              l.contact_email ??
              l.contact_phone ??
              "Unknown lead";
            return (
              <Card key={l.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900">{name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {dateShort(l.captured_at)} · via {l.source}
                      {l.service_type ? ` · ${l.service_type}` : ""}
                    </p>
                    {l.title && (
                      <p className="mt-1 text-sm text-neutral-700">
                        {l.title}
                      </p>
                    )}
                    {l.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                        {l.message}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {l.contact_phone && (
                        <a
                          href={`tel:${l.contact_phone}`}
                          className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800"
                        >
                          📞 {l.contact_phone}
                        </a>
                      )}
                      {l.contact_email && (
                        <a
                          href={`mailto:${l.contact_email}`}
                          className="rounded bg-sky-100 px-2 py-0.5 font-medium text-sky-800"
                        >
                          ✉ {l.contact_email}
                        </a>
                      )}
                      {l.service_address && (
                        <a
                          href={`https://www.google.com/maps/?q=${encodeURIComponent(l.service_address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-neutral-100 px-2 py-0.5 text-neutral-700"
                        >
                          📍 {l.service_address}
                        </a>
                      )}
                      {l.requested_price != null && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                          ${Number(l.requested_price).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <LeadActions
                    leadId={l.id}
                    status={l.status}
                    hasClient={Boolean(l.client_id)}
                    clientId={l.client_id}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
