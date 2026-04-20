import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPillLink } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { LeadActions } from "../lead-actions";
import { AutoRefresh } from "./auto-refresh";

/**
 * Website Leads — filtered view of leads sourced from the marketing site.
 *
 * Only shows leads where `source LIKE 'marketing/%'` (the convention set
 * by /api/leads, which prefixes every same-origin marketing form post
 * with "marketing/" and the page slug).
 *
 * Adds two things the generic /dashboard/leads doesn't:
 *   1. Source-page column with a clickable link to the landing page
 *      that produced the lead. Directly actionable intel: which pages
 *      are converting, which aren't.
 *   2. SLA clock — minutes since capture vs the 1-hour callback promise.
 *      Red if past SLA, amber if approaching, green if fresh.
 *
 * Polls every 30s via <AutoRefresh /> so a new lead appears within
 * half a minute without a manual reload.
 *
 * "Convert to Jobber" button is a stub — the API call wires up in a
 * separate session. Today it just nudges the client's
 * `jobber_sync_status` to 'pending' so the future cron can pick it up.
 */

export const metadata = { title: "Website Leads — Rose Concrete" };

type WebsiteLead = {
  id: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  service_type: string | null;
  message: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  client_id: string | null;
  client_name: string | null;
  jobber_sync_status: "pending" | "synced" | "excluded" | "not_synced" | null;
  captured_at: string;
  responded_at: string | null;
};

type SearchParams = Promise<{
  source?: string;
  service?: string;
  days?: string;
}>;

const STATUS_FILTERS = ["new", "contacted", "qualified", "converted", "lost"] as const;

const SLA_HOURS = 1;

export default async function WebsiteLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { source, service, days } = await searchParams;
  const dayWindow = Math.max(1, Math.min(90, Number(days ?? 30)));

  const supabase = await createClient();
  let q = supabase
    .from("marketing_leads_view")
    .select("*")
    .gte(
      "captured_at",
      new Date(Date.now() - dayWindow * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("captured_at", { ascending: false })
    .limit(200);
  if (source) q = q.eq("source", source);
  if (service) q = q.eq("service_type", service);

  const { data: rowsRaw, error } = await q;
  const leads = ((rowsRaw ?? []) as unknown as WebsiteLead[]) ?? [];

  // Per-source-page counts for the source filter pills.
  const sourceCounts = new Map<string, number>();
  for (const l of leads) {
    sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1);
  }
  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // SLA bucket counts.
  const now = Date.now();
  const slaMs = SLA_HOURS * 60 * 60 * 1000;
  let slaPast = 0;
  let slaApproaching = 0;
  let slaFresh = 0;
  let slaContacted = 0;
  for (const l of leads) {
    if (l.responded_at) {
      slaContacted++;
      continue;
    }
    const age = now - new Date(l.captured_at).getTime();
    if (age > slaMs) slaPast++;
    else if (age > slaMs * 0.66) slaApproaching++;
    else slaFresh++;
  }

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="Website Leads"
        subtitle={`${leads.length} in the last ${dayWindow} day${dayWindow === 1 ? "" : "s"} from the marketing site`}
        actions={
          <Link
            href="/dashboard/leads"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            All leads →
          </Link>
        }
      />

      {/* SLA dashboard strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SlaCard
          label="Past 1hr SLA"
          count={slaPast}
          tone={slaPast > 0 ? "danger" : "neutral"}
        />
        <SlaCard
          label="Approaching SLA"
          count={slaApproaching}
          tone={slaApproaching > 0 ? "warning" : "neutral"}
        />
        <SlaCard label="Fresh" count={slaFresh} tone="info" />
        <SlaCard label="Contacted" count={slaContacted} tone="success" />
      </div>

      {/* Filter row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <StatusPillLink
            href="/dashboard/leads/website"
            active={!source && !service}
            label="All sources"
            count={leads.length}
          />
          {topSources.map(([src, count]) => {
            const params = new URLSearchParams();
            params.set("source", src);
            return (
              <StatusPillLink
                key={src}
                href={`/dashboard/leads/website?${params.toString()}`}
                active={source === src}
                label={shortSource(src)}
                count={count}
              />
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">
          Auto-refreshes every 30 seconds. Showing the last {dayWindow} days.
          {error && ` · DB error: ${error.message}`}
        </p>
      </div>

      {leads.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            No website leads in the last {dayWindow} days. Leads from the
            apex marketing site land here automatically — they&apos;re
            written via <code>/api/leads</code> with{" "}
            <code>source = marketing/&lt;page&gt;</code>.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <WebsiteLeadCard key={l.id} lead={l} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function SlaCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "danger" | "warning" | "info" | "success" | "neutral";
}) {
  const toneClasses: Record<typeof tone, string> = {
    danger: "border-red-300 bg-red-50 text-red-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-sky-300 bg-sky-50 text-sky-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    neutral: "border-neutral-200 bg-white text-neutral-700",
  };
  return (
    <div
      className={`rounded-lg border p-3 ${toneClasses[tone]}`}
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold">{count}</p>
    </div>
  );
}

function WebsiteLeadCard({ lead, now }: { lead: WebsiteLead; now: number }) {
  const name =
    lead.contact_name ??
    lead.client_name ??
    lead.contact_email ??
    lead.contact_phone ??
    "Unknown";
  const slaTone = !lead.responded_at
    ? slaToneFor(now - new Date(lead.captured_at).getTime())
    : "contacted";

  // Strip the leading `marketing/` from the source for the cleaner display
  // — the column is implied by being on this page.
  const cleanSource = lead.source.replace(/^marketing\//, "") || "/";
  // Where on the public site this lead came from. Reconstruct the full
  // path so the tab opens the actual landing page.
  const publicHref = "/" + cleanSource.replace(/^\/+/, "");

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-brand-900">{name}</p>
            <SlaPill tone={slaTone} capturedAt={lead.captured_at} now={now} />
            <StatusBadge status={lead.status} />
            {lead.jobber_sync_status &&
              lead.jobber_sync_status !== "not_synced" && (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                  Jobber: {lead.jobber_sync_status}
                </span>
              )}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            {dateShort(lead.captured_at)} · from{" "}
            <a
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-brand-700 underline hover:text-accent-600"
            >
              /{cleanSource}
            </a>
            {lead.service_type ? ` · ${lead.service_type.replace(/_/g, " ")}` : ""}
          </p>

          {lead.message && (
            <p className="mt-2 text-sm text-neutral-700 line-clamp-3">
              {lead.message}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {lead.contact_phone && (
              <a
                href={`tel:${lead.contact_phone}`}
                className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-200"
              >
                📞 Call {lead.contact_phone}
              </a>
            )}
            {lead.contact_phone && (
              <a
                href={`sms:${lead.contact_phone}`}
                className="rounded bg-sky-100 px-2 py-1 font-medium text-sky-800 hover:bg-sky-200"
              >
                💬 Text
              </a>
            )}
            {lead.contact_email && (
              <a
                href={`mailto:${lead.contact_email}`}
                className="rounded bg-neutral-100 px-2 py-1 font-medium text-neutral-700 hover:bg-neutral-200"
              >
                ✉ {lead.contact_email}
              </a>
            )}
            {lead.client_id && (
              <Link
                href={`/dashboard/clients/${lead.client_id}`}
                className="rounded bg-brand-100 px-2 py-1 font-medium text-brand-800 hover:bg-brand-200"
              >
                View client →
              </Link>
            )}
          </div>
        </div>

        <div className="shrink-0 sm:min-w-[180px]">
          <LeadActions
            leadId={lead.id}
            status={lead.status}
            hasClient={Boolean(lead.client_id)}
            clientId={lead.client_id}
          />
          <p className="mt-2 text-[10px] text-neutral-400">
            Push-to-Jobber stub on the client detail page.
          </p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: WebsiteLead["status"] }) {
  const TONE: Record<WebsiteLead["status"], string> = {
    new: "border-sky-300 bg-sky-100 text-sky-800",
    contacted: "border-amber-300 bg-amber-100 text-amber-800",
    qualified: "border-violet-300 bg-violet-100 text-violet-800",
    converted: "border-emerald-300 bg-emerald-100 text-emerald-800",
    lost: "border-neutral-300 bg-neutral-100 text-neutral-700",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[status]}`}
    >
      {status}
    </span>
  );
}

type SlaTone = "fresh" | "approaching" | "past" | "contacted";

function slaToneFor(ageMs: number): SlaTone {
  const slaMs = SLA_HOURS * 60 * 60 * 1000;
  if (ageMs > slaMs) return "past";
  if (ageMs > slaMs * 0.66) return "approaching";
  return "fresh";
}

function SlaPill({
  tone,
  capturedAt,
  now,
}: {
  tone: SlaTone;
  capturedAt: string;
  now: number;
}) {
  const ageMin = Math.floor((now - new Date(capturedAt).getTime()) / 60000);
  if (tone === "contacted") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
        Replied
      </span>
    );
  }
  const TONE: Record<Exclude<SlaTone, "contacted">, string> = {
    fresh: "bg-sky-100 text-sky-800",
    approaching: "bg-amber-100 text-amber-800",
    past: "bg-red-100 text-red-800",
  };
  const LABEL: Record<Exclude<SlaTone, "contacted">, string> = {
    fresh: "fresh",
    approaching: "SLA close",
    past: "SLA missed",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[tone]}`}
      title={`${ageMin} minutes since capture`}
    >
      {LABEL[tone]} · {ageMin}m
    </span>
  );
}

function shortSource(s: string): string {
  // marketing/landing/safe-sidewalks-program-san-diego → safe-sidewalks…
  const stripped = s.replace(/^marketing\//, "");
  const last = stripped.split("/").pop() ?? stripped;
  return last.length > 28 ? last.slice(0, 26) + "…" : last;
}

void STATUS_FILTERS; // exported helper for future filter UI; intentionally unused for now
