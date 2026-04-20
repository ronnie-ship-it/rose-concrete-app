import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

/**
 * Marketing-leads dashboard widget.
 *
 * Three rolled-up KPIs:
 *   - Leads this week (count of marketing/* leads in last 7 days)
 *   - Top-converting page (highest lead volume in last 30 days)
 *   - SLA hit rate (% contacted within 1hr) over last 30 days
 * + a horizontal bar chart of leads-per-source-page (last 30 days).
 *
 * Server component — pulls from `marketing_leads_view` (mig 029) so the
 * source filter is server-side. Pure CSS bar chart, no charting deps.
 *
 * "Cost per lead" placeholder is shown but blank until Google Ads
 * integration lands and starts pushing spend numbers.
 */

const SLA_HOURS = 1;

export async function MarketingLeadsWidget() {
  const supabase = await createClient();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const slaMs = SLA_HOURS * 60 * 60 * 1000;

  // One read covers everything — the view is small and indexed on captured_at.
  const { data: leads30Raw } = await supabase
    .from("marketing_leads_view")
    .select("source, captured_at, responded_at")
    .gte("captured_at", thirtyDaysAgo)
    .order("captured_at", { ascending: false })
    .limit(500);

  const leads30 = (leads30Raw ?? []) as Array<{
    source: string;
    captured_at: string;
    responded_at: string | null;
  }>;

  const leadsThisWeek = leads30.filter(
    (l) => new Date(l.captured_at).getTime() >= new Date(sevenDaysAgo).getTime(),
  );

  // Per-source counts (last 30d), descending.
  const bySource = new Map<string, number>();
  for (const l of leads30) {
    bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
  }
  const topSources = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]);
  const topSource = topSources[0];
  const topVolumeMax = topSource?.[1] ?? 1;

  // SLA hit rate.
  let slaHits = 0;
  let slaTotal = 0;
  for (const l of leads30) {
    if (!l.responded_at) {
      // Unresponded — only count as SLA-eligible if past SLA (otherwise still in flight).
      const age = now - new Date(l.captured_at).getTime();
      if (age > slaMs) {
        slaTotal++;
      }
      continue;
    }
    const respondedIn = new Date(l.responded_at).getTime() - new Date(l.captured_at).getTime();
    slaTotal++;
    if (respondedIn <= slaMs) slaHits++;
  }
  const slaPct =
    slaTotal === 0 ? null : Math.round((slaHits / slaTotal) * 100);

  return (
    <Card className="border-brand-100">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Marketing site
          </p>
          <h2 className="text-lg font-bold text-brand-900">
            Leads this week
          </h2>
        </div>
        <Link
          href="/dashboard/leads/website"
          className="text-xs font-semibold text-brand-700 hover:text-accent-600"
        >
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Leads · 7d" value={leadsThisWeek.length.toString()} />
        <Kpi
          label="Top page"
          value={topSource ? short(topSource[0]) : "—"}
          sub={topSource ? `${topSource[1]} leads · 30d` : "no leads yet"}
        />
        <Kpi
          label="SLA hit · 30d"
          value={slaPct === null ? "—" : `${slaPct}%`}
          sub={slaPct === null ? "no closed leads" : `${slaHits} / ${slaTotal}`}
          tone={
            slaPct === null
              ? "neutral"
              : slaPct >= 90
                ? "good"
                : slaPct >= 70
                  ? "warn"
                  : "bad"
          }
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Leads by source page · last 30 days
        </p>
        {topSources.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No marketing-site leads yet. The first lead from{" "}
            <code>/api/leads</code> will land here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {topSources.slice(0, 6).map(([src, count]) => (
              <li key={src} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-xs text-brand-700">
                  /{src.replace(/^marketing\//, "")}
                </span>
                <div className="relative h-5 flex-1 rounded-md bg-brand-50">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-accent-500"
                    style={{ width: `${(count / topVolumeMax) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative ml-2 text-xs font-bold text-brand-900">
                    {count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded border border-dashed border-neutral-300 p-2 text-[11px] text-neutral-500">
        <span className="font-bold">Cost per lead</span>: enable when Google
        Ads spend is connected. Coming after the ads-account session.
      </div>
    </Card>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const VALUE_TONE = {
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    neutral: "text-brand-900",
  } as const;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-2xl font-extrabold ${VALUE_TONE[tone]}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>
      )}
    </div>
  );
}

function short(s: string): string {
  const stripped = s.replace(/^marketing\//, "");
  const last = stripped.split("/").pop() ?? stripped;
  return last.length > 18 ? last.slice(0, 16) + "…" : last;
}
