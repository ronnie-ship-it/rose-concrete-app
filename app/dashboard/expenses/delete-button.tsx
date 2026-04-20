"use client";

import { useTransition } from "react";
import { deleteExpenseAction } from "./actions";

export function DeleteExpenseButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this expense?")) return;
        start(async () => {
          await deleteExpenseAction(id);
        });
      }}
      className="text-xs text-red-600 hover:underline"
    >
      Delete
    </button>
  );
}
