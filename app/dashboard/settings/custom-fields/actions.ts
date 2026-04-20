"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type FieldResult = { ok: true } | { ok: false; error: string };

const ENTITIES = ["client", "project", "quote"] as const;
const TYPES = ["text", "number", "date", "boolean", "select"] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function upsertFieldAction(
  _prev: FieldResult | null,
  fd: FormData,
): Promise<FieldResult> {
  try {
    await requireRole(["admin"]);
    const id = String(fd.get("id") ?? "") || null;
    const entity_type = String(fd.get("entity_type") ?? "");
    const label = String(fd.get("label") ?? "").trim();
    const field_type = String(fd.get("field_type") ?? "");
    const position = Number(fd.get("position") ?? 0);
    const isRequired = String(fd.get("is_required") ?? "") === "on";
    const optionsRaw = String(fd.get("options") ?? "").trim();

    if (!(ENTITIES as readonly string[]).includes(entity_type)) {
      return { ok: false, error: "Invalid entity." };
    }
    if (!(TYPES as readonly string[]).includes(field_type)) {
      return { ok: false, error: "Invalid field type." };
    }
    if (!label) return { ok: false, error: "Label is required." };

    const key = slugify(label);
    if (!key) return { ok: false, error: "Label couldn't be slugified." };

    const options =
      field_type === "select"
        ? optionsRaw
            .split(/\r?\n|,/)
            .map((s) => s.trim())
            .filter(Boolean)
        : null;

    const supabase = createServiceRoleClient();
    const payload: Record<string, unknown> = {
      entity_type,
      key,
      label,
      field_type,
      position: Number.isFinite(position) ? position : 0,
      is_required: isRequired,
      options,
    };
    if (id) {
      const { error } = await supabase
        .from("custom_field_definitions")
        .update(payload)
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("custom_field_definitions")
        .insert(payload);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/dashboard/settings/custom-fields");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function deleteFieldAction(
  id: string,
): Promise<FieldResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("custom_field_definitions")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/custom-fields");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
