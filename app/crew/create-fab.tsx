"use client";

/**
 * Jobber-mobile FAB — dark circular button bottom-right that, when
 * tapped, EXPANDS upward into a vertical column of labelled icon
 * buttons. Each row is `[Label]   (○ icon)` — label text floats to the
 * left of the circle.  The order from bottom to top exactly mirrors
 * Jobber's screenshot:
 *
 *      Request   (📥)         <- top
 *      Task      (📋)
 *      Expense   ($ )
 *      Invoice   ($ )
 *      Quote     (🔍)
 *      Job       (🔨)
 *      Client    (👤)         <- last item (closest to FAB)
 *      [+]                     <- FAB itself (active = dark filled)
 *
 * The FAB pivots: closed shows `+`, open shows the same person silhouette
 * as the "Client" row to mirror the iOS screenshot exactly. Tapping
 * outside the menu OR the dimmed backdrop closes it.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Action = {
  href: string;
  label: string;
  /** Path data for a 24×24 stroke-only icon. */
  iconPath: string;
};

// Order from TOP to BOTTOM — matches Jobber's screenshot order.
const ACTIONS: Action[] = [
  {
    href: "/dashboard/requests/new",
    label: "Request",
    iconPath:
      "M3 12V5h18v7M3 12l3 7h12l3-7M9 12h6",
  },
  {
    href: "/dashboard/tasks",
    label: "Task",
    iconPath:
      "M8 4h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 4V3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1M9 12l2 2 4-4",
  },
  {
    href: "/dashboard/expenses/new",
    label: "Expense",
    iconPath:
      "M12 2v20M17 5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6",
  },
  {
    href: "/dashboard/payments",
    label: "Invoice",
    iconPath:
      "M5 3h11l4 4v14H5V3zM12 8v8M9 11h6M9 14h4",
  },
  {
    href: "/dashboard/quotes/quick",
    label: "Quote",
    iconPath:
      "M7 3h10l4 4v14H3V3h4M3 8h6l1 2h2M11 13a3 3 0 1 0 3 3M14 16l3 3",
  },
  {
    href: "/dashboard/projects/new",
    label: "Job",
    iconPath:
      "M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z",
  },
  {
    href: "/dashboard/clients/new",
    label: "Client",
    iconPath:
      "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6",
  },
];

export function CreateFab() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while menu is open (matches native iOS feel).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop — semi-transparent white wash, just like Jobber. */}
      {open && (
        <button
          type="button"
          aria-label="Close create menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-white/85"
        />
      )}

      {/* Stacked action rows — only rendered when open. */}
      {open && (
        <div
          className="fixed z-50 flex flex-col items-end gap-3"
          style={{
            right: "calc(env(safe-area-inset-right, 0) + 16px)",
            bottom: "calc(env(safe-area-inset-bottom, 0) + 88px)",
          }}
        >
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3"
            >
              <span className="rounded-full text-base font-bold text-[#1a2332]">
                {a.label}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1a2332] shadow-md ring-1 ring-neutral-200">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={a.iconPath} />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* The FAB itself — fixed bottom-right above the bottom nav. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close create menu" : "Create"}
        aria-expanded={open}
        className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2332] text-white shadow-lg active:scale-95"
        style={{
          right: "calc(env(safe-area-inset-right, 0) + 16px)",
          bottom: "calc(env(safe-area-inset-bottom, 0) + 16px)",
        }}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Person silhouette — matches the iOS "open" FAB icon */}
            <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
          </svg>
        ) : (
          <span className="text-3xl leading-none">+</span>
        )}
      </button>
    </>
  );
}
