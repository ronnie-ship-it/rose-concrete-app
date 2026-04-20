import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader,
  Card,
  EmptyState,
  StatusPill,
  StatusPillLink,
} from "@/components/ui";
import { dateShort, money } from "@/lib/format";
import { serviceLabel } from "@/lib/service-types";
import { RequestActions } from "./request-actions";

export const metadata = { title: "Requests — Rose Concrete" };

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
] as const;

type StatusKey = (typeof STATUSES)[number] | "overdue" | "all";

type SearchParams = Promise<{ status?: string; source?: string; q?: string }>;

type LeadRow = {
  id: string;
  source: string | null;
  status: string;
  captured_at: string;
  responded_at: string | null;
  converted_at: string | null;
  service_type: string | null;
  message: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  service_address: string | null;
  requested_price: number | null;
  client_id: string | null;
  project_id: string | null;
  quote_id: string | null;
  client: { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null;
  quote: { id: string; number: string; status: string } | { id: string; number: string; status: string }[] | null;
  project: { id: string; name: string; status: string } | { id: string; name: string; status: string }[] | null;
};

function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { status, source, q } = await searchParams;
  const activeView: StatusKey = (STATUSES as readonly string[]).includes(status ?? "")
    ? ((status as StatusKey) ?? "new")
    : status === "overdue"
      ? "overdue"
      : status === "all"
        ? "all"
        : "new";
  const query = (q ?? "").trim();

  const supabase = await createClient();

  // Pull the list for the active tab + the counts we need to render the
  // filter pills in one round trip each.
  let builder = supabase
    .from("leads")
    .select(
      "id, source, status, captured_at, responded_at, converted_at, service_type, message, contact_name, contact_phone, contact_email, service_address, requested_price, client_id, project_id, quote_id, archived_at, client:clients(id, name, phone), quote:quotes(id, number, status), project:projects(id, name, status)",
    )
    .is("archived_at", null) // hide archived leads (cascaded from archived client)
    .order("captured_at", { ascending: false })
    .limit(200);

  if (activeView === "overdue") {
    builder = builder
      .eq("status", "new")
      .lt(
        "captured_at",
        new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      );
  } else if (activeView !== "all") {
    builder = builder.eq("status", activeView);
  }
  if (source) builder = builder.eq("source", source);
  if (query) {
    builder = builder.or(
      `contact_name.ilike.%${query}%,contact_phone.ilike.%${query}%,contact_email.ilike.%${query}%,service_address.ilike.%${query}%`,
    );
  }

  const [{ data: rows }, counts, sources] = await Promise.all([
    builder,
    Promise.all(
      STATUSES.map((s) =>
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status", s),
      ),
    ),
    supabase.from("leads").select("source").limit(1000),
  ]);

  const countByStatus: Record<string, number> = {};
  counts.forEach((r, i) => {
    countByStatus[STATUSES[i]] = r.count ?? 0;
  });
  const overdueCount =
    (
      await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "new")
        .lt(
          "captured_at",
          new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        )
    ).count ?? 0;

  const sourceOptions = Array.from(
    new Set(((sources.data ?? []) as Array<{ source: string | null }>).map((r) => r.source).filter(Boolean)),
  ) as string[];

  const leads = (rows ?? []) as LeadRow[];

  function pillHref(target: StatusKey): string {
    const params = new URLSearchParams();
    if (target !== "new") params.set("status", target);
    if (source) params.set("source", source);
    if (query) params.set("q", query);
    const qs = params.toString();
    return `/dashboard/requests${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        subtitle="Inbound inquiries from your website, booking form, and OpenPhone. Work them through to a quote."
        actions={
          <Link
            href="/book"
            target="_blank"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Open booking form
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <StatusPillLink
          href={pillHref("new")}
          label="New"
          count={countByStatus.new ?? 0}
          active={activeView === "new"}
        />
        <StatusPillLink
          href={pillHref("overdue")}
          label="Overdue (>48h)"
          count={overdueCount}
          active={activeView === "overdue"}
        />
        <StatusPillLink
          href={pillHref("contacted")}
          label="Contacted"
          count={countByStatus.contacted ?? 0}
          active={activeView === "contacted"}
        />
        <StatusPillLink
          href={pillHref("qualified")}
          label="Qualified"
          count={countByStatus.qualified ?? 0}
          active={activeView === "qualified"}
        />
        <StatusPillLink
          href={pillHref("converted")}
          label="Converted"
          count={countByStatus.converted ?? 0}
          active={activeView === "converted"}
        />
        <StatusPillLink
          href={pillHref("lost")}
          label="Lost"
          count={countByStatus.lost ?? 0}
          active={activeView === "lost"}
        />
        <StatusPillLink
          href={pillHref("all")}
          label="All"
          active={activeView === "all"}
        />
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
      >
        {activeView !== "new" && (
          <input type="hidden" name="status" value={activeView} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name / phone / email / address…"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          name="source"
          defaultValue={source ?? ""}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Filter
        </button>
        {(query || source) && (
          <Link
            href={pillHref(activeView)}
            className="px-2 text-sm text-neutral-500 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <EmptyState
          title="No requests"
          description="Fresh inquiries from the website, booking form, or OpenPhone land here."
        />
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const client = Array.isArray(lead.client)
              ? lead.client[0]
              : lead.client;
            const quote = Array.isArray(lead.quote)
              ? lead.quote[0]
              : lead.quote;
            const project = Array.isArray(lead.project)
              ? lead.project[0]
              : lead.project;
            const h = hoursSince(lead.captured_at);
            const isOverdue = lead.status === "new" && h >= 48;
            return (
              <Card key={lead.id} className="p-0">
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {lead.contact_name ??
                          client?.name ??
                          lead.contact_phone ??
                          lead.contact_email ??
                          "Unknown"}
                      </p>
                      <StatusPill
                        status={lead.status}
                        tone={
                          lead.status === "converted"
                            ? "success"
                            : lead.status === "lost"
                              ? "neutral"
                              : lead.status === "qualified"
                                ? "brand"
                                : isOverdue
                                  ? "danger"
                                  : "info"
                        }
                      />
                      {lead.source && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                          via {lead.source}
                        </span>
                      )}
                      {lead.service_type && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">
                          {serviceLabel(lead.service_type)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-600">
                      {lead.contact_phone && (
                        <a
                          href={`tel:${lead.contact_phone}`}
                          className="hover:underline"
                        >
                          📞 {lead.contact_phone}
                        </a>
                      )}
                      {lead.contact_email && (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="hover:underline"
                        >
                          ✉ {lead.contact_email}
                        </a>
                      )}
                      {lead.service_address && (
                        <a
                          href={`https://www.google.com/maps/?q=${encodeURIComponent(lead.service_address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          📍 {lead.service_address}
                        </a>
                      )}
                    </div>
                    {lead.message && (
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-neutral-700">
                        {lead.message}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {dateShort(lead.captured_at)} · {h}h ago
                      {lead.requested_price != null &&
                        ` · asking ${money(lead.requested_price)}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 md:min-w-[220px]">
                    <div className="flex flex-wrap gap-1.5">
                      {client && (
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                        >
                          Client
                        </Link>
                      )}
                      {project && (
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                        >
                          Project
                        </Link>
                      )}
                      {quote && (
                        <Link
                          href={`/dashboard/quotes/${quote.id}`}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                        >
                          Quote {quote.number}
                        </Link>
                      )}
                    </div>
                    <RequestActions
                      leadId={lead.id}
                      currentStatus={lead.status}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
