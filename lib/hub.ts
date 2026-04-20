import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Client Hub — customer-facing portal. A client opens the per-client
 * hub URL `/hub/<token>` and sees their quotes, invoices, job history,
 * messages, and file uploads. Token lookup is service-role so RLS
 * doesn't get in the way; every query we run downstream is manually
 * scoped to that client's id.
 */
export type HubClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export async function loadHubClient(token: string): Promise<HubClient | null> {
  if (!token || token.length < 16) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, phone, address")
    .eq("hub_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as HubClient;
}
