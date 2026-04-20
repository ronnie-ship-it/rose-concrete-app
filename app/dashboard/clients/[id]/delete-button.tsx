"use client";

export function DeleteClientButton({
  action,
  clientName,
}: {
  action: () => Promise<void>;
  clientName: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete ${clientName}? This removes the client and any projects, quotes, and visits attached to them.`
          )
        ) {
          e.preventDefault();
        }
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
