"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { seedDefaultScheduleFromQuote } from "@/lib/payment-schedules";
import { seedDefaultJobChecklist } from "@/lib/workflows";

// ---------- helpers ----------

async function recomputeTotals(quoteId: string) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("quote_line_items")
    .select("is_optional, quantity, unit_price")
    .eq("quote_id", quoteId);

  let base = 0;
  let optional = 0;
  for (const it of items ?? []) {
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unit_price ?? 0);
    const lt = qty * price;
    if (it.is_optional) optional += lt;
    else base += lt;
  }
  await supabase
    .from("quotes")
    .update({ base_total: base, optional_total: optional })
    .eq("id", quoteId);
}

async function generateQuoteNumber(): Promise<string> {
  const supabase = await createClient();
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(today.getDate()).padStart(2, "0")}`;
  // Count today's quotes for sequence.
  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .like("number", `${ymd}-%`);
  const seq = String((count ?? 0) + 1).padStart(2, "0");
  return `${ymd}-${seq}`;
}

// ---------- create / send / delete quote ----------

const CreateQuoteSchema = z.object({
  project_id: z.string().uuid("Pick a project"),
});

export type QuoteCreateState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function createQuoteAction(
  _prev: QuoteCreateState,
  formData: FormData
): Promise<QuoteCreateState> {
  await requireRole(["admin", "office"]);
  const parsed = CreateQuoteSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const supabase = await createClient();
  const number = await generateQuoteNumber();
  const { data, error } = await supabase
    .from("quotes")
    .insert({ project_id: parsed.data.project_id, number })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Bump project status to 'quoting' if still 'lead'.
  await supabase
    .from("projects")
    .update({ status: "quoting" })
    .eq("id", parsed.data.project_id)
    .eq("status", "lead");

  revalidatePath("/dashboard/quotes");
  redirect(`/dashboard/quotes/${data.id}`);
}

/**
 * Duplicate an existing quote and all of its line items into a new draft.
 * Clones: project_id, title, scope_markdown, balance_terms, personal_note,
 * warranty_months, deposit_* fields, + every line item (requires/optional).
 * Does NOT clone: status, accepted_*, locked_*, approved_at, sent_at,
 * public_token (a fresh one is minted on insert).
 *
 * Redirects to the new quote's editor on success. Used by the
 * "Create similar quote" button on the quote detail page.
 */
export async function createSimilarQuoteAction(
  sourceId: string,
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: src, error: srcErr } = await supabase
    .from("quotes")
    .select(
      "project_id, title, scope_markdown, balance_terms, personal_note, warranty_months, deposit_percent, deposit_amount, deposit_nonrefundable, valid_through",
    )
    .eq("id", sourceId)
    .single();
  if (srcErr || !src) throw new Error(srcErr?.message ?? "Source not found");

  const number = await generateQuoteNumber();
  const { data: newQuote, error: insErr } = await supabase
    .from("quotes")
    .insert({
      project_id: src.project_id,
      number,
      title: src.title ?? null,
      scope_markdown: src.scope_markdown ?? null,
      balance_terms: src.balance_terms ?? null,
      personal_note: src.personal_note ?? null,
      warranty_months: src.warranty_months ?? null,
      deposit_percent: src.deposit_percent ?? null,
      deposit_amount: src.deposit_amount ?? null,
      deposit_nonrefundable: src.deposit_nonrefundable ?? true,
      valid_through: src.valid_through ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (insErr || !newQuote) {
    throw new Error(insErr?.message ?? "Failed to duplicate quote");
  }

  const { data: items } = await supabase
    .from("quote_line_items")
    .select(
      "title, description, quantity, unit, unit_price, is_optional, is_selected, position",
    )
    .eq("quote_id", sourceId)
    .order("position", { ascending: true });
  if (items && items.length > 0) {
    await supabase.from("quote_line_items").insert(
      items.map((it) => ({
        quote_id: newQuote.id,
        title: it.title,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        is_optional: it.is_optional,
        is_selected: it.is_optional ? false : it.is_selected,
        position: it.position,
      })),
    );
    await recomputeTotals(newQuote.id);
  }

  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${sourceId}`);
  redirect(`/dashboard/quotes/${newQuote.id}`);
}

export async function deleteQuoteAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/quotes");
  redirect("/dashboard/quotes");
}

/**
 * Soft-archive — flips status to `expired` + stamps `expired_at` so the
 * quote stops appearing in the pipeline funnel but stays visible under
 * the "All" filter. Prefer this over `deleteQuoteAction` for historical
 * records (accepted quotes with signed contracts, etc.).
 */
export async function archiveQuoteAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  await supabase
    .from("quotes")
    .update({
      status: "expired",
      expired_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath(`/dashboard/quotes/${id}`);
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/pipeline");
}

/**
 * SMS the customer a reminder with the public quote link. Uses OpenPhone,
 * silently no-ops when unwired. Logs to activity_log regardless.
 */
export async function sendQuoteReminderAction(
  id: string,
): Promise<
  | { ok: true; sent: boolean; skip: boolean }
  | { ok: false; error: string }
> {
  try {
    const user = await requireRole(["admin", "office"]);
    const supabase = await createClient();
    const { data: quote } = await supabase
      .from("quotes")
      .select(
        "id, number, public_token, project:projects(name, client:clients(name, phone))",
      )
      .eq("id", id)
      .maybeSingle();
    if (!quote) return { ok: false, error: "Quote not found." };
    type P = {
      name: string;
      client:
        | { name: string; phone: string | null }
        | { name: string; phone: string | null }[]
        | null;
    };
    const project = Array.isArray(quote.project)
      ? (quote.project as P[])[0]
      : (quote.project as P | null);
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null;
    if (!client?.phone) {
      return { ok: false, error: "Client has no phone on file." };
    }
    const { normalizePhone, getOpenPhoneAdapter } = await import(
      "@/lib/openphone"
    );
    const phone = normalizePhone(client.phone);
    if (!phone) {
      return { ok: false, error: "Phone number couldn't be parsed." };
    }
    const base = process.env.APP_BASE_URL ?? "https://sandiegoconcrete.ai";
    const url = `${base}/q/${quote.public_token}`;
    const firstName = (client.name ?? "").split(/\s+/)[0] || "there";
    const body = `Hi ${firstName} — this is Rose Concrete. Just a heads up on quote ${quote.number}${
      project?.name ? ` for ${project.name}` : ""
    }. You can review and approve here: ${url}`;

    const adapter = getOpenPhoneAdapter();
    const res = await adapter.sendMessage(phone, body);

    await supabase.from("activity_log").insert({
      entity_type: "quote",
      entity_id: id,
      action: "reminder_sent",
      actor_id: user.id,
      payload: {
        phone,
        body,
        delivery: res.ok
          ? { ok: true, external_id: res.external_id }
          : { ok: false, error: res.error, skip: res.skip },
      },
    });

    revalidatePath(`/dashboard/quotes/${id}`);
    return { ok: true, sent: res.ok, skip: !res.ok && res.skip };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send.",
    };
  }
}

export async function markQuoteSentAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  // Stamp `sent_at` only on first send so a re-mark doesn't trample the
  // original send timestamp (the timeline-breadcrumb component on the
  // quote detail relies on the first value).
  const { data: existing } = await supabase
    .from("quotes")
    .select("sent_at")
    .eq("id", id)
    .maybeSingle();
  const patch: Record<string, unknown> = { status: "sent" };
  if (!existing?.sent_at) patch.sent_at = new Date().toISOString();
  await supabase.from("quotes").update(patch).eq("id", id);
  revalidatePath(`/dashboard/quotes/${id}`);
}

/**
 * One-click "convert quote to job" — Jobber-parity primary action.
 *
 * Admin-side path (the public `/q/[token]/actions.ts::acceptQuoteAction`
 * handles the client-self-serve path). When Ronnie clicks this on the
 * quote editor we:
 *   1. Flip quote → accepted, set accepted_total = base + optional
 *      (admin manually accepting on behalf of the client, all-in price)
 *      and stamp accepted_at + accepted_by_name = "Rose Concrete (admin)".
 *   2. Bump the parent project to `approved` (only if it's currently
 *      in lead/quoting; we don't downgrade an already-active project).
 *   3. Seed the default payment schedule from the quote (helper is
 *      idempotent and flag-gated).
 *   4. Drop an activity_log entry so the conversion is auditable.
 *   5. Redirect to the project page — that's where the next action
 *      (schedule a visit, send invoice) lives.
 *
 * Idempotent: if the quote is already accepted we still re-seed the
 * schedule (no-op if it exists) and redirect, so a double-click doesn't
 * throw.
 */
export async function convertQuoteToJobAction(quoteId: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const actor = await requireUser();
  const supabase = await createClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select(
      "id, project_id, status, base_total, optional_total, accepted_total"
    )
    .eq("id", quoteId)
    .single();
  if (qErr || !quote) throw new Error(qErr?.message ?? "Quote not found.");

  const base = Number(quote.base_total ?? 0);
  const optional = Number(quote.optional_total ?? 0);
  // Admin acceptance includes all optional add-ons by default — Ronnie can
  // edit the line items beforehand if the client wants only some.
  const acceptedTotal =
    quote.accepted_total != null ? Number(quote.accepted_total) : base + optional;

  if (quote.status !== "accepted") {
    const { error: upErr } = await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_total: acceptedTotal,
        accepted_at: new Date().toISOString(),
        accepted_by_name: "Rose Concrete (admin)",
      })
      .eq("id", quoteId);
    if (upErr) throw new Error(upErr.message);
  }

  // Stamp the converted-at timestamp for the status timeline. Separate
  // from accepted_at so we can show both steps — a quote is "approved"
  // the moment it's accepted, "converted" the moment it produces a job.
  await supabase
    .from("quotes")
    .update({ converted_at: new Date().toISOString() })
    .eq("id", quoteId)
    .is("converted_at", null);

  // Promote the project. Don't clobber `active` / `done` / `cancelled`.
  await supabase
    .from("projects")
    .update({ status: "approved" })
    .eq("id", quote.project_id)
    .in("status", ["lead", "quoting"]);

  // Seed the payment schedule. Helper is no-op when flag off or already seeded.
  const seed = await seedDefaultScheduleFromQuote(quote.project_id);

  // Seed the 14-step default job checklist if no service_type-specific
  // template matched. The service-type seeder already ran via
  // updateProjectAction's hook; this call is idempotent and only adds
  // rows when the project is completely empty. Safety net so every
  // approved quote lands with something Ronnie can schedule from.
  const checklist = await seedDefaultJobChecklist(quote.project_id);

  await supabase.from("activity_log").insert({
    entity_type: "quote",
    entity_id: quoteId,
    action: "quote_converted_to_job",
    actor_id: actor.id,
    payload: {
      project_id: quote.project_id,
      accepted_total: acceptedTotal,
      schedule_seeded: seed.ok ? seed : { ok: false, error: seed.error },
      checklist_seeded: checklist,
    },
  });

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath(`/dashboard/projects/${quote.project_id}`);
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${quote.project_id}`);
}

// ---------- update quote meta (scope, terms, totals defaults) ----------

const QuoteMetaSchema = z.object({
  scope_markdown: z.string().max(20000).optional().or(z.literal("")),
  personal_note: z.string().max(2000).optional().or(z.literal("")),
  valid_through: z.string().optional().or(z.literal("")),
  deposit_percent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  deposit_amount: z.coerce.number().min(0).optional().or(z.literal("")),
  deposit_nonrefundable: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
  warranty_months: z.coerce.number().int().min(0).max(240).optional().or(z.literal("")),
  balance_terms: z.string().max(500).optional().or(z.literal("")),
  estimated_duration_days: z.coerce.number().int().min(0).max(365).optional().or(z.literal("")),
  salesperson_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().max(200).optional().or(z.literal("")),
});

export type QuoteMetaState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function updateQuoteMetaAction(
  id: string,
  _prev: QuoteMetaState,
  formData: FormData
): Promise<QuoteMetaState> {
  await requireRole(["admin", "office"]);
  const parsed = QuoteMetaSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const data = parsed.data;
  const update: Record<string, unknown> = {
    scope_markdown: data.scope_markdown || "",
    personal_note: data.personal_note || null,
    deposit_percent:
      data.deposit_percent === "" || data.deposit_percent === undefined
        ? null
        : data.deposit_percent,
    deposit_amount:
      data.deposit_amount === "" || data.deposit_amount === undefined
        ? null
        : data.deposit_amount,
    deposit_nonrefundable: data.deposit_nonrefundable === "on",
    warranty_months:
      data.warranty_months === "" || data.warranty_months === undefined
        ? 36
        : data.warranty_months,
    balance_terms: data.balance_terms || "Balance due upon completion.",
    estimated_duration_days:
      data.estimated_duration_days === "" ||
      data.estimated_duration_days === undefined
        ? null
        : data.estimated_duration_days,
  };
  if (data.valid_through) update.valid_through = data.valid_through;
  if (data.salesperson_id !== undefined) {
    update.salesperson_id = data.salesperson_id || null;
  }
  if (data.title !== undefined) {
    update.title = data.title || null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/quotes/${id}`);
  return { ok: true };
}

// ---------- line items ----------

const LineItemSchema = z.object({
  quote_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().max(20).optional().or(z.literal("")),
  unit_price: z.coerce.number().min(0).default(0),
  is_optional: z.union([z.literal("on"), z.literal("")]).optional(),
  photo_id: z.string().uuid().optional().or(z.literal("")),
});

export async function addLineItemAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "office"]);
  const parsed = LineItemSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid line item");
  }
  const d = parsed.data;
  const supabase = await createClient();

  // Position = max(position) + 1 within this quote.
  const { data: maxRow } = await supabase
    .from("quote_line_items")
    .select("position")
    .eq("quote_id", d.quote_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("quote_line_items").insert({
    quote_id: d.quote_id,
    title: d.title,
    description: d.description || null,
    quantity: d.quantity,
    unit: d.unit || "job",
    unit_price: d.unit_price,
    is_optional: d.is_optional === "on",
    photo_id: d.photo_id || null,
    position: nextPos,
  });
  if (error) throw new Error(error.message);

  await recomputeTotals(d.quote_id);
  revalidatePath(`/dashboard/quotes/${d.quote_id}`);
}

export async function addLineItemFromTemplateAction(
  quoteId: string,
  templateId: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { data: tpl, error: tplErr } = await supabase
    .from("line_item_templates")
    .select("title, description, unit, unit_price, default_quantity")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();
  if (tplErr) throw new Error(tplErr.message);
  if (!tpl) throw new Error("Template not found or inactive.");

  const { data: maxRow } = await supabase
    .from("quote_line_items")
    .select("position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("quote_line_items").insert({
    quote_id: quoteId,
    title: tpl.title,
    description: tpl.description ?? null,
    quantity: Number(tpl.default_quantity ?? 1),
    unit: tpl.unit ?? "job",
    unit_price: Number(tpl.unit_price ?? 0),
    is_optional: false,
    photo_id: null,
    position: nextPos,
  });
  if (error) throw new Error(error.message);
  await recomputeTotals(quoteId);
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}

export async function deleteLineItemAction(
  itemId: string,
  quoteId: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  await recomputeTotals(quoteId);
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}

export async function toggleLineItemOptionalAction(
  itemId: string,
  quoteId: string,
  isOptional: boolean
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_line_items")
    .update({ is_optional: isOptional })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  await recomputeTotals(quoteId);
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}

/**
 * Attach / swap / clear the photo on an existing line item. The photo
 * dropdown on the line-items editor calls this — empty `photoId` clears
 * the attachment (FK becomes null); any other uuid must exist in the
 * `photos` table (the insert FK constraint will reject junk).
 */
export async function setLineItemPhotoAction(
  itemId: string,
  quoteId: string,
  photoId: string | null,
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_line_items")
    .update({ photo_id: photoId || null })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}
