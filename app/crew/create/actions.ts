"use server";

/**
 * Server actions used by the Jobber-mobile-style "New X" forms in the
 * crew app.
 *
 * All redirects target /crew/* paths so the mobile experience stays
 * inside the crew PWA. After a successful save, we redirect to a
 * crew-friendly destination (the new detail page when one exists,
 * otherwise back to /crew home) with a `?saved=<kind>` flag that
 * the layout-mounted CrewToast picks up and renders as a brief
 * green confirmation banner.
 *
 * Schemas to mind:
 *   - clients(name, phone, email, address, city, state, postal_code,
 *             source) — see migration 001
 *   - leads(source[NOT NULL], contact_name, notes, status,
 *           captured_at, service_address, service_type) — 001 + 014/018
 *   - tasks(title, body, status, client_id, project_id, due_at,
 *           source, source_id) — migration 013
 *   - expenses(project_id, vendor, category, amount, note, receipt_url,
 *              expense_date, paid_from, created_by) — migration 032
 */
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Build a redirect URL that lands the user back somewhere sensible
 * with a success or error toast.
 */
function ok(path: string, kind: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}saved=${encodeURIComponent(kind)}`;
}
function fail(formPath: string, message: string): string {
  return `${formPath}?error=${encodeURIComponent(message)}`;
}

// ─────────────────────────── Clients ───────────────────────────

export async function createClientFromCrewAction(formData: FormData): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim().toUpperCase() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const leadSource = String(formData.get("lead_source") ?? "").trim() || null;

  // Name preference: company → first+last → just first.
  const name =
    company ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed client)";

  // Need at least a phone or email so the office can reach them. Match
  // the office quick-create rule so the data shape stays consistent.
  if (!phone && !email) {
    redirect(
      fail(
        "/crew/create/client",
        "Please add a phone number or email so we can reach the client.",
      ),
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      phone,
      email,
      address,
      city,
      state,
      postal_code: postalCode,
      source: leadSource,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(fail("/crew/create/client", error?.message ?? "Save failed"));
  }
  redirect(ok(`/crew/clients/${data.id}`, "client"));
}

// ─────────────────────────── Tasks ───────────────────────────

export async function createTaskFromCrewAction(formData: FormData): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("description") ?? "").trim() || null;
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!title) {
    redirect(fail("/crew/create/task", "Title is required"));
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("tasks").insert({
    title,
    body,
    status: "open",
    client_id: clientId,
    due_at: dueDate ? new Date(dueDate).toISOString() : null,
    source: "crew_app",
  });
  if (error) {
    redirect(fail("/crew/create/task", error.message));
  }
  redirect(ok("/crew", "task"));
}

// ─────────────────────────── Expenses ───────────────────────────

export async function createExpenseFromCrewAction(formData: FormData): Promise<void> {
  const user = await requireRole(["crew", "admin", "office"]);
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("description") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "").trim();
  const amount =
    Number(String(formData.get("total") ?? "0").replace(/[^0-9.-]/g, "")) || 0;
  const projectId = String(formData.get("project_id") ?? "").trim() || null;

  if (!title) {
    redirect(fail("/crew/create/expense", "Title is required"));
  }
  if (amount <= 0) {
    redirect(fail("/crew/create/expense", "Total must be greater than $0"));
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("expenses").insert({
    vendor: title,
    note,
    amount,
    expense_date: date || new Date().toISOString().slice(0, 10),
    project_id: projectId,
    created_by: user.id,
    paid_from: "card",
    category: "other",
  });
  if (error) {
    redirect(fail("/crew/create/expense", error.message));
  }
  redirect(ok("/crew", "expense"));
}

// ─────────────────────────── Requests (lead intake) ───────────────────────────

export async function createRequestFromCrewAction(formData: FormData): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const clientId = String(formData.get("client_id") ?? "").trim() || null;

  if (!title) {
    redirect(fail("/crew/create/request", "Title is required"));
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("leads").insert({
    source: "crew_app",
    contact_name: title,
    notes: description,
    status: "new",
    captured_at: new Date().toISOString(),
    client_id: clientId,
  });
  if (error) {
    redirect(fail("/crew/create/request", error.message));
  }
  redirect(ok("/crew", "request"));
}
