"use server";

/**
 * Server actions used by the Jobber-mobile-style "New X" forms in the
 * crew app.
 *
 * Schemas to mind:
 *   - clients(name, phone, email, address, source) — see migration 001
 *   - leads(source[NOT NULL], contact_name, notes, status, captured_at,
 *           service_address, service_type) — migrations 001 + 014/018
 *   - tasks(title, body, status, client_id, project_id, due_at,
 *           source, source_id) — migration 013
 *   - expenses(project_id, vendor, category, amount, note, receipt_url,
 *              expense_date, paid_from, created_by) — migration 032
 */
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

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

  // Name preference: company → first+last → just first
  const name =
    company ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed client)";

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
  if (error) {
    redirect(`/crew/create/client?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/clients/${data!.id}`);
}

// ─────────────────────────── Tasks ───────────────────────────

export async function createTaskFromCrewAction(formData: FormData): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("description") ?? "").trim() || null;
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!title) {
    redirect("/crew/create/task?error=Title%20is%20required");
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
    redirect(`/crew/create/task?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard/tasks");
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

  if (!title || amount <= 0) {
    redirect(
      "/crew/create/expense?error=Title%20and%20a%20positive%20total%20are%20required",
    );
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
    redirect(`/crew/create/expense?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard/expenses");
}

// ─────────────────────────── Requests (lead intake) ───────────────────────────

export async function createRequestFromCrewAction(formData: FormData): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const clientId = String(formData.get("client_id") ?? "").trim() || null;

  if (!title) {
    redirect("/crew/create/request?error=Title%20is%20required");
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
    redirect(`/crew/create/request?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard/requests");
}
