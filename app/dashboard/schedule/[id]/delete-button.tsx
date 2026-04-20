"use client";

export function DeleteVisitButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this visit?")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
