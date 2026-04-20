import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Every Phase 2/2.5/3 module is gated by a row in public.feature_flags so
 * Ronnie can turn things on and off from the admin settings page without
 * redeploying. Keep this union in sync with migration 001's seed insert.
 */
export type FeatureFlagKey =
  | "quotes_optional_items"
  | "docusign_auto_send"
  | "openphone_intake"
  | "qbo_job_costing"
  | "marketing_dashboard"
  | "daily_email_digest"
  | "social_post_drafter"
  | "crew_mobile_view"
  | "gdrive_photo_sync"
  | "google_ads_autonomous"
  | "google_ads_shadow_mode"
  | "duda_monitor"
  | "material_ordering"
  | "payment_schedules"
  | "payment_reminders"
  | "qbo_receipt_auto_send"
  | "lead_webhook"
  | "review_request_auto_send"
  | "visit_reminders"
  | "docusign_auto_send_on_accept"
  | "qbo_auto_invoice";

export type FeatureFlag = {
  key: FeatureFlagKey;
  enabled: boolean;
  config: Record<string, unknown>;
};

/**
 * Loads every flag in one round-trip and caches it for the lifetime of the
 * request. Server components can call isFeatureEnabled() as many times as they
 * like without hitting the DB again.
 *
 * Deliberately does NOT throw if the table is missing or unreachable — a bad
 * flags lookup should never take the dashboard down. On failure every flag
 * reports disabled, which is the safe default for Phase 2 modules.
 */
const loadFlags = cache(async (): Promise<Map<string, FeatureFlag>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled, config");

    if (error || !data) return new Map();

    const map = new Map<string, FeatureFlag>();
    for (const row of data) {
      map.set(row.key, {
        key: row.key as FeatureFlagKey,
        enabled: !!row.enabled,
        config: (row.config ?? {}) as Record<string, unknown>,
      });
    }
    return map;
  } catch {
    return new Map();
  }
});

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await loadFlags();
  return flags.get(key)?.enabled ?? false;
}

export async function getFeatureFlag(
  key: FeatureFlagKey
): Promise<FeatureFlag | null> {
  const flags = await loadFlags();
  return flags.get(key) ?? null;
}

export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  const flags = await loadFlags();
  return Array.from(flags.values()).sort((a, b) => a.key.localeCompare(b.key));
}
