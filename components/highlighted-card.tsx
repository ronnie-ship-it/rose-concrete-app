"use client";

/**
 * "Highlighted" promotional card in the dashboard right rail, matching
 * Jobber's Marketing Suite upsell. Dismissible: the close (×) stashes
 * a `rc:highlight-dismissed-{key}=1` value in localStorage so the card
 * stays hidden for that user until they clear storage.
 *
 * We use this slot for genuine Rose-Concrete upsells (e.g. "Connect
 * Gmail", "Turn on QBO payouts"), not fake marketing copy.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  /** Stable dismissal key. Changing it re-shows the card. */
  storageKey: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HighlightedCard({ storageKey, title, body, ctaLabel, ctaHref }: Props) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    const v = localStorage.getItem(`rc:highlight-dismissed-${storageKey}`);
    setDismissed(v === "1");
  }, [storageKey]);
  if (dismissed) return null;
  return (
    <section className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-jobber-line dark:bg-jobber-card">
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(`rc:highlight-dismissed-${storageKey}`, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:text-jobber-text-2 dark:hover:text-white"
      >
        ×
      </button>
      <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-jobber-text-2">
        Highlighted
      </h3>
      <p className="mt-3 text-base font-extrabold text-neutral-900 dark:text-white">
        {title}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-jobber-text-2">
        {body}
      </p>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-jobber-green px-4 py-1.5 text-xs font-bold text-neutral-900 hover:brightness-110"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
