"use client";

import { useActionState } from "react";
import { uploadQboCsvAction, type UploadState } from "./actions";

const initial: UploadState = null;

export function QboUploadForm() {
  const [state, action, pending] = useActionState(uploadQboCsvAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          htmlFor="qbo-csv"
          className="mb-1 block text-sm font-medium text-neutral-800"
        >
          QuickBooks CSV
        </label>
        <input
          id="qbo-csv"
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-1 text-xs text-neutral-500">
          In QuickBooks: Reports → &ldquo;Transaction List by Customer&rdquo;
          or &ldquo;Expenses by Vendor Detail&rdquo; → Export → Comma Separated
          Values. Max 5 MB.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import CSV"}
      </button>

      {state && state.ok === false && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      {state && state.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <div className="font-medium">Imported.</div>
          <ul className="mt-1 list-inside list-disc text-xs">
            <li>{state.summary.totalRows} rows parsed</li>
            <li>
              {state.summary.inserted} new,{" "}
              {state.summary.duplicates} duplicate (already imported)
            </li>
            <li>
              {state.summary.matched} matched to a project,{" "}
              {state.summary.unmatched} need manual assignment
            </li>
            {state.summary.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
