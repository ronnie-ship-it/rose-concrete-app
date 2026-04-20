import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Phase 2 — Daily marketing metrics sync cron.
 *
 * Called by Vercel Cron (see vercel.json) at 6 AM Pacific every day. Each
 * adapter below fetches yesterday's metrics for one channel and writes them
 * to the `marketing_metrics` table. The morning email digest (next Phase 2
 * module) reads from that table at 7 AM.
 *
 * Adapters are intentionally stubbed until API creds are configured:
 *   - Semrush → needs SEMRUSH_API_KEY
 *   - Google Ads → needs GOOGLE_ADS_* creds
 *   - Meta Ads → needs META_MARKETING_TOKEN
 *   - Thumbtack → parsed from Gmail, uses existing Gmail MCP
 *
 * The cron secret prevents public access. Set CRON_SECRET in Vercel env.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service-role client for cron (no user session).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const results: Record<string, { ok: boolean; message: string }> = {};

  // --- Semrush ---
  results.semrush = await syncSemrush(supabase, dateStr);

  // --- Google Ads ---
  results.google_ads = await syncGoogleAds(supabase, dateStr);

  // --- Meta Ads ---
  results.meta_ads = await syncMetaAds(supabase, dateStr);

  // --- Thumbtack (Gmail parse) ---
  results.thumbtack = await syncThumbtack(supabase, dateStr);

  return NextResponse.json({ date: dateStr, results });
}

// ---------- Adapters ----------

// Use a permissive type for the cron client. The cron writes to tables
// that aren't in the generated Database types, so the generic-inferred
// row type is `never`, which breaks every insert/upsert. This module
// is server-only and the payload shapes are controlled here, so the
// loss of type safety is localised.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

async function upsertMetric(
  supabase: Supabase,
  date: string,
  channel: string,
  metricName: string,
  value: number,
  meta: Record<string, unknown> = {}
) {
  await supabase.from("marketing_metrics").upsert(
    { date, channel, metric_name: metricName, value, meta },
    { onConflict: "date,channel,metric_name" }
  );
}

async function syncSemrush(
  supabase: Supabase,
  date: string
): Promise<{ ok: boolean; message: string }> {
  if (!process.env.SEMRUSH_API_KEY) {
    return { ok: false, message: "SEMRUSH_API_KEY not configured" };
  }

  // TODO: call Semrush API — domain overview for roseconcrete.com
  // const res = await fetch(`https://api.semrush.com/...?key=${process.env.SEMRUSH_API_KEY}&domain=roseconcrete.com`);
  // Parse organic_traffic, organic_keywords, paid_traffic
  // await upsertMetric(supabase, date, "semrush", "organic_traffic", value);

  return { ok: false, message: "Adapter stub — Semrush API integration pending" };
}

async function syncGoogleAds(
  supabase: Supabase,
  date: string
): Promise<{ ok: boolean; message: string }> {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return { ok: false, message: "GOOGLE_ADS_DEVELOPER_TOKEN not configured" };
  }

  // TODO: call Google Ads API via REST or google-ads-api package
  // Fetch: spend, impressions, clicks, conversions, cpl for each campaign
  // await upsertMetric(supabase, date, "google_ads", "spend", spend);
  // await upsertMetric(supabase, date, "google_ads", "conversions", conversions);
  // await upsertMetric(supabase, date, "google_ads", "cpl", cpl);

  return { ok: false, message: "Adapter stub — Google Ads API integration pending" };
}

async function syncMetaAds(
  supabase: Supabase,
  date: string
): Promise<{ ok: boolean; message: string }> {
  if (!process.env.META_MARKETING_TOKEN) {
    return { ok: false, message: "META_MARKETING_TOKEN not configured" };
  }

  // TODO: call Meta Marketing API — /act_{ad_account_id}/insights
  // Fetch: spend, impressions, clicks, conversions
  // await upsertMetric(supabase, date, "meta_ads", "spend", spend);

  return { ok: false, message: "Adapter stub — Meta Ads API integration pending" };
}

async function syncThumbtack(
  supabase: Supabase,
  date: string
): Promise<{ ok: boolean; message: string }> {
  // Thumbtack doesn't have an API — we parse lead-notification emails from
  // Gmail. The existing `poptin-lead-processor` skill has a Gmail parse
  // pattern we can reuse here. For now, stub it.

  // TODO: search Gmail for Thumbtack lead emails from yesterday,
  // count unique leads, write to marketing_metrics.

  return { ok: false, message: "Adapter stub — Thumbtack Gmail parse pending" };
}
