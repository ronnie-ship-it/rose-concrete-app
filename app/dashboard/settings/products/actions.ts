"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ProductResult = { ok: true; id?: string } | { ok: false; error: string };

export async function upsertProductAction(
  _prev: ProductResult | null,
  fd: FormData,
): Promise<ProductResult> {
  try {
    await requireRole(["admin"]);
    const id = String(fd.get("id") ?? "") || null;
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    const category =
      String(fd.get("category") ?? "").trim() || "General";
    const unit = String(fd.get("unit") ?? "").trim() || "job";
    const unitPrice = Number(fd.get("unit_price") ?? 0);
    const defaultQty = Number(fd.get("default_quantity") ?? 1);
    const cost = fd.get("cost") ? Number(fd.get("cost")) : null;
    const isTaxable = String(fd.get("is_taxable") ?? "") === "on";
    const isActive = String(fd.get("is_active") ?? "on") === "on";
    // Bookable-online toggle — when off, hide this product from the
    // public booking form even though it stays in the quoting catalog.
    const isBookable = String(fd.get("is_bookable_online") ?? "") === "on";
    const bookingDisplayName =
      String(fd.get("booking_display_name") ?? "").trim() || null;
    const sortOrder = Number(fd.get("sort_order") ?? 100);
    if (!title) return { ok: false, error: "Title is required." };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false, error: "Unit price must be a positive number." };
    }

    const supabase = createServiceRoleClient();
    if (id) {
      const { error } = await supabase
        .from("line_item_templates")
        .update({
          title,
          description,
          category,
          unit,
          unit_price: unitPrice,
          default_quantity: Number.isFinite(defaultQty) ? defaultQty : 1,
          cost: cost != null && Number.isFinite(cost) ? cost : null,
          is_taxable: isTaxable,
          is_active: isActive,
          is_bookable_online: isBookable,
          booking_display_name: bookingDisplayName,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
        })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id };
    } else {
      const { data, error } = await supabase
        .from("line_item_templates")
        .insert({
          title,
          description,
          category,
          unit,
          unit_price: unitPrice,
          default_quantity: Number.isFinite(defaultQty) ? defaultQty : 1,
          cost: cost != null && Number.isFinite(cost) ? cost : null,
          is_taxable: isTaxable,
          is_active: isActive,
          is_bookable_online: isBookable,
          booking_display_name: bookingDisplayName,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
        })
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Failed to insert." };
      }
      return { ok: true, id: data.id };
    }
  } finally {
    revalidatePath("/dashboard/settings/products");
    revalidatePath("/dashboard/settings/line-items");
  }
}

export async function deleteProductAction(
  id: string,
): Promise<ProductResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("line_item_templates")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/products");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
