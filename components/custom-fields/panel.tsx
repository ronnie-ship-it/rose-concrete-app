"use client";

import { useState, useTransition } from "react";
import { upsertCustomFieldValueAction } from "./actions";
import type {
  CustomFieldEntity,
  CustomFieldRow,
} from "@/lib/custom-fields";

/**
 * Inline edit panel for custom fields on client / project / quote
 * detail pages. Each field renders the appropriate input; on blur the
 * value is upserted via server action. No explicit save button.
 */
export function CustomFieldsPanel({
  entityType,
  entityId,
  rows,
}: {
  entityType: CustomFieldEntity;
  entityId: string;
  rows: CustomFieldRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No custom fields configured for {entityType}s. Add one at{" "}
        <a
          href="/dashboard/settings/custom-fields"
          className="text-brand-700 hover:underline"
        >
          Settings → Custom fields
        </a>
        .
      </p>
    );
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((r) => (
        <CustomFieldRow
          key={r.def.id}
          entityType={entityType}
          entityId={entityId}
          row={r}
        />
      ))}
    </ul>
  );
}

function CustomFieldRow({
  entityType,
  entityId,
  row,
}: {
  entityType: CustomFieldEntity;
  entityId: string;
  row: CustomFieldRow;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  function save(value: string) {
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await upsertCustomFieldValueAction(
        entityType,
        entityId,
        row.def.id,
        value,
      );
      if (!res.ok) setErr(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }
    });
  }

  const { def, value } = row;
  let initial = "";
  if (value) {
    if (def.field_type === "text" || def.field_type === "select") {
      initial = value.value_text ?? "";
    } else if (def.field_type === "number" && value.value_number != null) {
      initial = String(value.value_number);
    } else if (def.field_type === "date") {
      initial = value.value_date ?? "";
    } else if (def.field_type === "boolean") {
      initial = value.value_bool ? "true" : "false";
    }
  }

  return (
    <li className="grid gap-2 py-2 md:grid-cols-[180px_1fr_80px] md:items-center">
      <p className="text-xs font-medium text-neutral-700">
        {def.label}
        {def.is_required && <span className="ml-0.5 text-red-600">*</span>}
      </p>
      <div>
        {def.field_type === "text" && (
          <input
            defaultValue={initial}
            onBlur={(e) => save(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        )}
        {def.field_type === "number" && (
          <input
            type="number"
            step="any"
            defaultValue={initial}
            onBlur={(e) => save(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        )}
        {def.field_type === "date" && (
          <input
            type="date"
            defaultValue={initial}
            onBlur={(e) => save(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        )}
        {def.field_type === "boolean" && (
          <select
            defaultValue={initial}
            onChange={(e) => save(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )}
        {def.field_type === "select" && (
          <select
            defaultValue={initial}
            onChange={(e) => save(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {(def.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-[11px] text-right">
        {pending ? (
          <span className="text-neutral-500">Saving…</span>
        ) : saved ? (
          <span className="text-emerald-700">Saved ✓</span>
        ) : err ? (
          <span className="text-red-600">{err}</span>
        ) : null}
      </p>
    </li>
  );
}
