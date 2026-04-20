"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type {
  CustomFieldEntity,
  CustomFieldType,
} from "@/lib/custom-fields";

export type UpsertFieldValueResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Upsert a custom-field value for an entity. Validated server-side: we
 * re-read the definition to confirm the entity_type matches, then cast
 * the incoming value into the right typed column (value_text /
 * value_number / value_date / value_bool).
 */
export async function upsertCustomFieldValueAction(
  entityType: CustomFieldEntity,
  entityId: string,
  definitionId: string,
  raw: string,
): Promise<UpsertFieldValueResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();

    const { data: def } = await supabase
      .from("custom_field_definitions")
      .select("id, entity_type, field_type")
      .eq("id", definitionId)
      .maybeSingle();
    if (!def) return { ok: false, error: "Definition not found." };
    if (def.entity_type !== entityType) {
      return {
        ok: false,
        error: `Definition is for ${def.entity_type}, not ${entityType}.`,
      };
    }

    const patch: Record<string, unknown> = {
      value_text: null,
      value_number: null,
      value_date: null,
      value_bool: null,
    };
    const fieldType = def.field_type as CustomFieldType;
    const trimmed = raw.trim();
    if (trimmed === "") {
      // Empty input clears the value.
    } else if (fieldType === "number") {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return { ok: false, error: "Value is not a number." };
      }
      patch.value_number = n;
    } else if (fieldType === "date") {
      // Accept YYYY-MM-DD; Postgres date is tolerant of ISO too.
      patch.value_date = trimmed;
    } else if (fieldType === "boolean") {
      patch.value_bool = ["true", "yes", "1", "on"].includes(
        trimmed.toLowerCase(),
      );
    } else {
      patch.value_text = trimmed;
    }

    const { error } = await supabase.from("custom_field_values").upsert(
      {
        definition_id: definitionId,
        entity_type: entityType,
        entity_id: entityId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "definition_id,entity_id" },
    );
    if (error) return { ok: false, error: error.message };

    if (entityType === "client") {
      revalidatePath(`/dashboard/clients/${entityId}`);
    } else if (entityType === "project") {
      revalidatePath(`/dashboard/projects/${entityId}`);
    } else if (entityType === "quote") {
      revalidatePath(`/dashboard/quotes/${entityId}`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
