/**
 * Tenant context helpers.
 *
 * Every data row in this app belongs to a tenant (row in public.tenants).
 * Users are pinned to a tenant via profiles.tenant_id. RLS enforces
 * isolation at the DB layer; the app layer uses these helpers to
 * stamp `tenant_id` on inserts so rows land in the right tenant
 * without a round-trip through `profiles` every write.
 *
 * Three exports:
 *   - getCurrentTenantId()   — server-side, reads from profiles via
 *                               the user's session. Cached per-request
 *                               via React's cache() so repeat calls
 *                               in the same SSR render are free.
 *   - requireTenantId()      — same, but throws if there is no
 *                               session or no tenant_id (should never
 *                               happen after signup).
 *   - getTenantInfo()        — returns the full tenant row (name,
 *                               plan, owner, etc.) for the Settings
 *                               → Tenant page.
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TenantInfo = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  owner_id: string | null;
  trial_ends_at: string | null;
};

/** Returns the current user's tenant_id, or null if not signed in. */
export const getCurrentTenantId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  return (profile?.tenant_id as string | null) ?? null;
});

/** Like getCurrentTenantId but throws when missing — use on action
 *  paths that must have a tenant. */
export async function requireTenantId(): Promise<string> {
  const id = await getCurrentTenantId();
  if (!id) {
    throw new Error(
      "No tenant on this session — sign out and sign back in.",
    );
  }
  return id;
}

export const getTenantInfo = cache(async (): Promise<TenantInfo | null> => {
  const supabase = await createClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const { data } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, status, owner_id, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();
  return (data as TenantInfo | null) ?? null;
});
