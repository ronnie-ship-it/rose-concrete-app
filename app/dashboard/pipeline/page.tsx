import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { money, dateShort } from "@/lib/format";

export const metadata = { title: "Pipeline — Rose Concrete" };

/**
 * Jobber-style sales pipeline kanban.
 *
 * Six columns — one per step from first inquiry to cash in bank:
 *   Request → Assessment → Quote draft → Awaiting response → Approved → Won (job active)
 *
 * Each column pulls from the system of record for that step:
 *   - Request / Assessment: `leads` rows with status in (new, contacted, qualified)
 *   - Quote draft: `quotes.status='draft'`
 *   - Awaiting response: `quotes.status='sent'`
 *   - Approved: `quotes.status='accepted'` (project not yet active)
 *   - Won: `projects.status in ('scheduled','active')`
 *
 * Read-only for v1 — the Jobber-parity kanban shows the funnel + dollar
 * value per column. Actions happen on the linked detail pages and the
 * Requests page (which already has the status-transition buttons).
 */

type CardProps = {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  meta?: string | null;
};

function Card({ href, title, subtitle, amount, meta }: CardProps) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow"
    >
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {subtitle && (
        <p className="mt-0.5 truncate text-xs text-neutral-600">{subtitle}</p>
      )}
      {amount != null && (
        <p className="mt-1 text-sm font-semibold text-brand-700">
          {money(amount)}
        </p>
      )}
      {meta && (
        <p className="mt-0.5 text-[11px] text-neutral-500">{meta}</p>
      )}
    </Link>
  );
}

type Column = {
  id: string;
  label: string;
  tone: string;
  items: CardProps[];
  totalValue: number;
};

function quoteValue(q: {
  accepted_total: number | string | null;
  base_total: number | string | null;
  optional_total: number | string | null;
}): number {
  if (q.accepted_total != null) return Number(q.accepted_total);
  return Number(q.base_total ?? 0) + Number(q.optional_total ?? 0);
}

export default async function PipelinePage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [
    newReqRes,
    contactedReqRes,
    qualifiedReqRes,
    draftQuotesRes,
    sentQuotesRes,
    approvedQuotesRes,
    activeProjectsRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, contact_name, contact_phone, captured_at, service_type, service_address, requested_price, client:clients(name)",
      )
      .eq("status", "new")
      .order("captured_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select(
        "id, contact_name, captured_at, service_type, client:clients(name), project_id",
      )
      .eq("status", "contacted")
      .order("captured_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select(
        "id, contact_name, captured_at, service_type, client:clients(name), project_id",
      )
      .eq("status", "qualified")
      .order("captured_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select(
        "id, number, status, issued_at, base_total, optional_total, accepted_total, project:projects(id, name, client:clients(name))",
      )
      .eq("status", "draft")
      .order("issued_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select(
        "id, number, status, issued_at, base_total, optional_total, accepted_total, project:projects(id, name, client:clients(name))",
      )
      .eq("status", "sent")
      .order("issued_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select(
        "id, number, status, accepted_at, base_total, optional_total, accepted_total, project:projects(id, name, status, client:clients(name))",
      )
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(50),
    supabase
      .from("projects")
      .select(
        "id, name, status, revenue_cached, scheduled_start, client:clients(name)",
      )
      .in("status", ["approved", "scheduled", "active"])
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);

  const columns: Column[] = [];

  // Request
  {
    const items: CardProps[] = ((newReqRes.data ?? []) as Array<{
      id: string;
      contact_name: string | null;
      contact_phone: string | null;
      captured_at: string;
      service_type: string | null;
      service_address: string | null;
      requested_price: number | null;
      client: { name: string } | { name: string }[] | null;
    }>).map((l) => {
      const c = Array.isArray(l.client) ? l.client[0] : l.client;
      return {
        id: l.id,
        href: `/dashboard/requests?status=new`,
        title: l.contact_name ?? c?.name ?? l.contact_phone ?? "New request",
        subtitle: l.service_address ?? l.service_type ?? null,
        amount: l.requested_price ?? null,
        meta: dateShort(l.captured_at),
      };
    });
    columns.push({
      id: "request",
      label: "New request",
      tone: "bg-amber-50 border-amber-200",
      items,
      totalValue: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    });
  }

  // Contacted
  {
    const items: CardProps[] = ((contactedReqRes.data ?? []) as Array<{
      id: string;
      contact_name: string | null;
      captured_at: string;
      service_type: string | null;
      client: { name: string } | { name: string }[] | null;
    }>).map((l) => {
      const c = Array.isArray(l.client) ? l.client[0] : l.client;
      return {
        id: l.id,
        href: `/dashboard/requests?status=contacted`,
        title: l.contact_name ?? c?.name ?? "Contacted lead",
        subtitle: l.service_type ?? null,
        meta: dateShort(l.captured_at),
      };
    });
    columns.push({
      id: "contacted",
      label: "Contacted",
      tone: "bg-sky-50 border-sky-200",
      items,
      totalValue: 0,
    });
  }

  // Qualified / assessment
  {
    const items: CardProps[] = ((qualifiedReqRes.data ?? []) as Array<{
      id: string;
      contact_name: string | null;
      captured_at: string;
      service_type: string | null;
      client: { name: string } | { name: string }[] | null;
    }>).map((l) => {
      const c = Array.isArray(l.client) ? l.client[0] : l.client;
      return {
        id: l.id,
        href: `/dashboard/requests?status=qualified`,
        title: l.contact_name ?? c?.name ?? "Qualified lead",
        subtitle: l.service_type ?? null,
        meta: dateShort(l.captured_at),
      };
    });
    columns.push({
      id: "qualified",
      label: "Assessment",
      tone: "bg-indigo-50 border-indigo-200",
      items,
      totalValue: 0,
    });
  }

  // Quote draft
  {
    type Row = {
      id: string;
      number: string;
      issued_at: string;
      base_total: number | string | null;
      optional_total: number | string | null;
      accepted_total: number | string | null;
      project:
        | {
            id: string;
            name: string;
            client: { name: string } | { name: string }[] | null;
          }
        | { id: string; name: string; client: unknown }[]
        | null;
    };
    const items: CardProps[] = ((draftQuotesRes.data ?? []) as Row[]).map((q) => {
      const p = Array.isArray(q.project) ? q.project[0] : q.project;
      const c = p
        ? Array.isArray(p.client)
          ? (p.client as Array<{ name: string }>)[0]
          : (p.client as { name: string } | null)
        : null;
      const v = quoteValue(q);
      return {
        id: q.id,
        href: `/dashboard/quotes/${q.id}`,
        title: `${q.number}`,
        subtitle: `${p?.name ?? "No project"}${c?.name ? ` · ${c.name}` : ""}`,
        amount: v,
        meta: `Draft · ${dateShort(q.issued_at)}`,
      };
    });
    columns.push({
      id: "draft",
      label: "Quote drafted",
      tone: "bg-neutral-50 border-neutral-200",
      items,
      totalValue: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    });
  }

  // Awaiting response
  {
    type Row = {
      id: string;
      number: string;
      issued_at: string;
      base_total: number | string | null;
      optional_total: number | string | null;
      accepted_total: number | string | null;
      project:
        | {
            id: string;
            name: string;
            client: { name: string } | { name: string }[] | null;
          }
        | { id: string; name: string; client: unknown }[]
        | null;
    };
    const items: CardProps[] = ((sentQuotesRes.data ?? []) as Row[]).map((q) => {
      const p = Array.isArray(q.project) ? q.project[0] : q.project;
      const c = p
        ? Array.isArray(p.client)
          ? (p.client as Array<{ name: string }>)[0]
          : (p.client as { name: string } | null)
        : null;
      const v = quoteValue(q);
      return {
        id: q.id,
        href: `/dashboard/quotes/${q.id}`,
        title: `${q.number}`,
        subtitle: `${p?.name ?? "No project"}${c?.name ? ` · ${c.name}` : ""}`,
        amount: v,
        meta: `Sent · ${dateShort(q.issued_at)}`,
      };
    });
    columns.push({
      id: "sent",
      label: "Awaiting response",
      tone: "bg-amber-50 border-amber-200",
      items,
      totalValue: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    });
  }

  // Approved (quote accepted but project not active yet)
  {
    type Row = {
      id: string;
      number: string;
      accepted_at: string | null;
      base_total: number | string | null;
      optional_total: number | string | null;
      accepted_total: number | string | null;
      project:
        | {
            id: string;
            name: string;
            status: string;
            client: { name: string } | { name: string }[] | null;
          }
        | { id: string; name: string; status: string; client: unknown }[]
        | null;
    };
    const items: CardProps[] = ((approvedQuotesRes.data ?? []) as Row[]).map(
      (q) => {
        const p = Array.isArray(q.project) ? q.project[0] : q.project;
        const c = p
          ? Array.isArray(p.client)
            ? (p.client as Array<{ name: string }>)[0]
            : (p.client as { name: string } | null)
          : null;
        const v = quoteValue(q);
        return {
          id: q.id,
          href: `/dashboard/quotes/${q.id}`,
          title: `${q.number}`,
          subtitle: `${p?.name ?? "No project"}${c?.name ? ` · ${c.name}` : ""}`,
          amount: v,
          meta: q.accepted_at ? `Approved · ${dateShort(q.accepted_at)}` : "Approved",
        };
      },
    );
    columns.push({
      id: "approved",
      label: "Approved",
      tone: "bg-emerald-50 border-emerald-200",
      items,
      totalValue: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    });
  }

  // Won (project active / scheduled)
  {
    type Row = {
      id: string;
      name: string;
      status: string;
      revenue_cached: number | string | null;
      scheduled_start: string | null;
      client: { name: string } | { name: string }[] | null;
    };
    const items: CardProps[] = ((activeProjectsRes.data ?? []) as Row[]).map(
      (p) => {
        const c = Array.isArray(p.client) ? p.client[0] : p.client;
        return {
          id: p.id,
          href: `/dashboard/projects/${p.id}`,
          title: p.name,
          subtitle: c?.name ?? null,
          amount: p.revenue_cached != null ? Number(p.revenue_cached) : null,
          meta: p.scheduled_start
            ? `Starts ${dateShort(p.scheduled_start)}`
            : `Status: ${p.status}`,
        };
      },
    );
    columns.push({
      id: "won",
      label: "Won",
      tone: "bg-fuchsia-50 border-fuchsia-200",
      items,
      totalValue: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline"
        subtitle="Every open deal from first inquiry to active job. Click a card to jump to it."
      />

      <div className="grid gap-3 overflow-x-auto lg:grid-cols-3 xl:grid-cols-6">
        {columns.map((col) => (
          <div
            key={col.id}
            className={`flex min-h-[200px] flex-col rounded-lg border p-3 ${col.tone}`}
          >
            <div className="mb-2 flex items-center justify-between border-b border-neutral-200/60 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                {col.label}
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                {col.items.length}
              </span>
            </div>
            {col.totalValue > 0 && (
              <p className="mb-2 text-xs font-medium text-neutral-600">
                {money(col.totalValue)}
              </p>
            )}
            <div className="flex flex-col gap-2 overflow-y-auto">
              {col.items.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-300 bg-white/60 p-3 text-center text-[11px] text-neutral-500">
                  Empty
                </div>
              ) : (
                col.items.map((card) => <Card key={card.id} {...card} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
