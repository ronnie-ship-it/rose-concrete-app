"use client";

import { useState, useTransition } from "react";
import { deleteFieldAction } from "./actions";
import { FieldForm } from "./field-form";

type Row = {
  id: string;
  entity_type: "client" | "project" | "quote";
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  position: number;
  is_required: boolean;
};

export function FieldRow({ row }: { row: Row }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <li className="p-3">
        <FieldForm initial={row} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-900">
          {row.label}{" "}
          {row.is_required && (
            <span className="text-[11px] text-red-600">*required</span>
          )}
        </p>
        <p className="text-xs text-neutral-500">
          <code className="rounded bg-neutral-100 px-1">{row.key}</code> ·{" "}
          {row.field_type}
          {row.field_type === "select" && row.options && row.options.length > 0
            ? ` (${row.options.join(", ")})`
            : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-brand-700 hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete field "${row.label}"?`)) return;
            start(async () => {
              await deleteFieldAction(row.id);
            });
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
