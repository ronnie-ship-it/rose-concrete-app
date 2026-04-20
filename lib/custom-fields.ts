/**
 * Custom-field plumbing. Migration 021 defined
 * `custom_field_definitions` + `custom_field_values`; migration 021
 * enum restricts entity_type to (client|project|quote). This module
 * loads the definitions + any existing values for a specific entity
 * and returns a shape the <CustomFieldsPanel> component renders.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

export type CustomFieldEntity = "client" | "project" | "quote";
export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";

export type CustomFieldDefinition = {
  id: string;
  entity_type: CustomFieldEntity;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  position: number;
  is_required: boolean;
};

export type CustomFieldValue = {
  id: string;
  definition_id: string;
  entity_type: CustomFieldEntity;
  entity_id: string;
  value_text: string | null;
  value_number: number | string | null;
  value_date: string | null;
  value_bool: boolean | null;
};

export type CustomFieldRow = {
  def: CustomFieldDefinition;
  value: CustomFieldValue | null;
};

/**
 * Load every definition for an entity type, left-joined with the
 * existing values on this specific entity_id. Used by the detail
 * pages to render the editor.
 */
export async function loadCustomFieldsFor(
  entityType: CustomFieldEntity,
  entityId: string,
): Promise<CustomFieldRow[]> {
  const supabase = createServiceRoleClient();
  const [{ data: defs }, { data: vals }] = await Promise.all([
    supabase
      .from("custom_field_definitions")
      .select("id, entity_type, key, label, field_type, options, position, is_required")
      .eq("entity_type", entityType)
      .order("position", { ascending: true }),
    supabase
      .from("custom_field_values")
      .select(
        "id, definition_id, entity_type, entity_id, value_text, value_number, value_date, value_bool",
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId),
  ]);
  const definitions = (defs ?? []) as CustomFieldDefinition[];
  const values = (vals ?? []) as CustomFieldValue[];
  const byDefId = new Map(values.map((v) => [v.definition_id, v]));
  return definitions.map((def) => ({
    def,
    value: byDefId.get(def.id) ?? null,
  }));
}

/** Format a stored value for read-only display. */
export function displayCustomValue(
  def: CustomFieldDefinition,
  value: CustomFieldValue | null,
): string {
  if (!value) return "—";
  switch (def.field_type) {
    case "text":
      return value.value_text ?? "—";
    case "number":
      return value.value_number != null
        ? String(value.value_number)
        : "—";
    case "date":
      return value.value_date ?? "—";
    case "boolean":
      return value.value_bool === true
        ? "Yes"
        : value.value_bool === false
          ? "No"
          : "—";
    case "select":
      return value.value_text ?? "—";
  }
}
