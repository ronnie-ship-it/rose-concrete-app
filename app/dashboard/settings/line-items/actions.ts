"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

/**
 * CRUD for the saved line-item library (`line_item_templates`). Used by
 * the quote editor's "Insert from library" picker and by this settings
 * page.
 */

export type Result = { ok: true } | { ok: false; error: string };

const TemplateSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  unit: z.string().trim().max(20).default("job"),
  unit_price: z.coerce.number().min(0).default(0),
  default_quantity: z.coerce.number().min(0).default(1),
  is_active: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
  sort_order: z.coerce.number().int().default(100),
});

export async function createTemplate(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  await requireRole(["admin"]);
  const parsed = TemplateSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("line_item_templates").insert({
    title: d.title,
    description: d.description || null,
    unit: d.unit || "job",
    unit_price: d.unit_price,
    default_quantity: d.default_quantity,
    is_active: d.is_active === "on" || d.is_active === "true",
    sort_order: d.sort_order,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/line-items");
  return { ok: true };
}

export async function updateTemplate(
  id: string,
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  await requireRole(["admin"]);
  const parsed = TemplateSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("line_item_templates")
    .update({
      title: d.title,
      description: d.description || null,
      unit: d.unit || "job",
      unit_price: d.unit_price,
      default_quantity: d.default_quantity,
      is_active: d.is_active === "on" || d.is_active === "true",
      sort_order: d.sort_order,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/line-items");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<void> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("line_item_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings/line-items");
}
