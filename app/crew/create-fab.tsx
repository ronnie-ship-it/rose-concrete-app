"use client";

/**
 * Dark-circle "+" FAB in the bottom-right corner, Jobber-mobile
 * style. Tap to open a bottom sheet with the shortcuts crew most
 * often need: Upload photo, Log cash entry, Start a form,
 * New note. The sheet dismisses on backdrop tap.
 */
import Link from "next/link";
import { useState } from "react";

type Action = { label: string; href: string; icon: string };

const ACTIONS: Action[] = [
  { label: "Upload photos", href: "/crew/upload", icon: "📷" },
  { label: "Start a form", href: "/crew/form", icon: "📝" },
  { label: "Log cash (day labor)", href: "/dashboard/cash-journal", icon: "💵" },
  { label: "Search anything", href: "/crew/search", icon: "🔍" },
];

export function CreateFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2332] text-white shadow-xl active:scale-95"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0) + 80px)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute inset-0 bg-black/50"
          />
          <div
            className="relative z-10 w-full rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,12px)] pt-2 shadow-xl dark:bg-neutral-900"
          >
            <div className="mx-auto my-2 h-1.5 w-10 rounded-full bg-neutral-300" />
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {ACTIONS.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[56px] items-center gap-4 px-5"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f5] text-lg dark:bg-neutral-800">
                      {a.icon}
                    </span>
                    <span className="text-base font-semibold text-[#1a2332] dark:text-white">
                      {a.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-1 block w-full py-4 text-center text-sm font-semibold text-neutral-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
