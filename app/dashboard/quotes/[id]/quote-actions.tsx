"use client";

import { useState, useTransition } from "react";

export function QuoteActions({
  publicUrl,
  status,
  markSent,
  del,
  convertToJob,
  createSimilar,
  quoteNumber,
}: {
  publicUrl: string;
  status: string;
  markSent: () => Promise<void>;
  del: () => Promise<void>;
  convertToJob: () => Promise<void>;
  createSimilar: () => Promise<void>;
  quoteNumber: string;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          const full =
            typeof window !== "undefined"
              ? `${window.location.origin}${publicUrl}`
              : publicUrl;
          await navigator.clipboard.writeText(full);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {copied ? "Copied!" : "Copy client link"}
      </button>
      <a
        href={publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Preview
      </a>
      {status === "draft" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markSent())}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          Mark sent
        </button>
      )}
      {status !== "accepted" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Convert quote ${quoteNumber} to a job? This accepts the quote on the client's behalf, flips the project to Approved, and seeds the payment schedule.`
              )
            )
              return;
            start(() => convertToJob());
          }}
          className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-60"
        >
          {pending ? "Converting…" : "✓ Convert to job"}
        </button>
      )}
      {status === "accepted" && (
        <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
          ✓ Accepted
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => createSimilar())}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {pending ? "…" : "Create similar"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete quote ${quoteNumber}? This cannot be undone.`))
            return;
          start(() => del());
        }}
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}
