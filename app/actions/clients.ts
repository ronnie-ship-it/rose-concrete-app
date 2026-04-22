"use server";

/**
 * Client search + quick-create actions used by the <ClientCombobox>
 * component on the quote / project / task forms.
 */
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ClientSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  updated_at: string;
};

/**
 * Search clients by name / phone / email. When `q` is empty, returns
 * the 5 most recently updated — matches Jobber's "recent first" order.
 */
export async function searchClientsAction(
  q: string,
  limit = 12,
): Promise<ClientSummary[]> {
  await requireRole(["admin", "office"]);
  const supabase = createServiceRoleClient();
  const query = q.trim();
  let builder = supabase
    .from("clients")
    .select("id, name, phone, email, city, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (query.length >= 1) {
    const pattern = `%${query}%`;
    builder = builder.or(
      `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`,
    );
  } else {
    builder = builder.limit(5);
  }
  const { data } = await builder;
  return (data ?? []) as ClientSummary[];
}

export type QuickClientResult =
  | { ok: true; client: ClientSummary }
  | { ok: false; error: string };

/**
 * Create a client from the combobox's inline "+ New client" panel.
 * Minimum fields: name + phone OR email (so we can actually reach them).
 */
export async function quickCreateClientAction(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): Promise<QuickClientResult> {
  try {
    await requireRole(["admin", "office"]);
    const name = input.name.trim();
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim() || null;
    const address = input.address?.trim() || null;
    if (!name) return { ok: false, error: "Name is required." };
    if (!phone && !email) {
      return {
        ok: false,
        error: "Phone or email is required so we can reach the client.",
      };
    }
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .insert({ name, phone, email, address })
      .select("id, name, phone, email, city, updated_at")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, client: data as ClientSummary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
