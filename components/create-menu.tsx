"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Jobber-style universal "+ Create" button.
 *
 * Drop-down of every create path in the app so office staff don't have to
 * navigate to the right list page first. Each option is a plain Link so it
 * plays nicely with Next.js routing and honors keyboard nav.
 */

type CreateOption = {
  href: string;
  label: string;
  desc: string;
  icon: string;
};

const OPTIONS: CreateOption[] = [
  {
    href: "/dashboard/clients/new",
    label: "Client",
    desc: "Add a new customer.",
    icon: "👤",
  },
  {
    href: "/dashboard/projects/new",
    label: "Job",
    desc: "Spin up a new project.",
    icon: "🧱",
  },
  {
    href: "/dashboard/quotes/new",
    label: "Quote",
    desc: "Draft a new estimate.",
    icon: "📄",
  },
  {
    href: "/dashboard/schedule/new",
    label: "Visit",
    desc: "Schedule a crew visit.",
    icon: "📅",
  },
  {
    href: "/dashboard/tasks",
    label: "Task",
    desc: "Add a follow-up task.",
    icon: "✓",
  },
  {
    href: "/dashboard/change-orders",
    label: "Change order",
    desc: "Customer-signable scope change.",
    icon: "✎",
  },
  {
    href: "/dashboard/concrete-order",
    label: "Concrete order",
    desc: "Group-text the pour crew.",
    icon: "🧰",
  },
  {
    href: "/book",
    label: "Online request (share link)",
    desc: "Send a customer the booking form.",
    icon: "🔗",
  },
];

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        btnRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        <span className="text-base leading-none">+</span>
        <span>Create</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <ul className="divide-y divide-neutral-100">
            {OPTIONS.map((o) => (
              <li key={o.href}>
                <Link
                  href={o.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-3 py-2.5 text-sm hover:bg-brand-50"
                >
                  <span className="mt-0.5 text-base">{o.icon}</span>
                  <span className="flex-1">
                    <p className="font-semibold text-neutral-900">{o.label}</p>
                    <p className="text-xs text-neutral-500">{o.desc}</p>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
