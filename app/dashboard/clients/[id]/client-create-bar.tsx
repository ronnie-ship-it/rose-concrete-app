"use client";

/**
 * Jobber-parity "+ New ___" row on the client detail page — every
 * creatable record type (Request, Quote, Job, Invoice, Payment, Task,
 * Property, Contact) reachable in one click with the client_id prefilled.
 *
 * Mix of Link buttons (forms live on other pages) and dispatch buttons
 * (Property + Contact open the existing inline panels; Invoice hands
 * off to the payment-schedule generator via a hash fragment that the
 * project page picks up).
 *
 * Design goal: Ronnie clicks once from the client page and lands with
 * the right client_id already in place — no hunt, no re-type.
 */
import Link from "next/link";
import { useState } from "react";

type Props = {
  clientId: string;
  primaryProjectId: string | null;
  onAddProperty?: () => void;
  onAddContact?: () => void;
};

export function ClientCreateBar({
  clientId,
  primaryProjectId,
  onAddProperty,
  onAddContact,
}: Props) {
  const [open, setOpen] = useState<null | "more">(null);

  const qs = `client_id=${clientId}`;

  // The most common flows live as primary buttons; the rest hide under
  // a "+ More" popover so the bar doesn't become a 10-button wall.
  const primary: Array<{ href: string; label: string }> = [
    { href: `/dashboard/requests?client_id=${clientId}`, label: "Request" },
    { href: `/dashboard/quotes/new?${qs}`, label: "Quote" },
    { href: `/dashboard/projects/new?${qs}`, label: "Job" },
    { href: `/dashboard/schedule/new?${qs}`, label: "Visit" },
  ];

  const more: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    hint?: string;
  }> = [
    {
      label: "Invoice",
      href: primaryProjectId
        ? `/dashboard/projects/${primaryProjectId}#billing`
        : undefined,
      disabled: !primaryProjectId,
      hint: primaryProjectId
        ? "Opens the job's billing panel"
        : "Create a job first to add an invoice",
    },
    {
      label: "Payment",
      href: primaryProjectId
        ? `/dashboard/projects/${primaryProjectId}#billing`
        : undefined,
      disabled: !primaryProjectId,
      hint: primaryProjectId
        ? "Copy pay link or record a payment in the billing panel"
        : "Create a job first",
    },
    {
      label: "Task",
      href: `/dashboard/tasks?${qs}&new=1`,
    },
    {
      label: "Property",
      onClick: onAddProperty,
      hint: "Scrolls to the Properties panel and focuses the form",
    },
    {
      label: "Contact",
      onClick: onAddContact,
      hint: "Scrolls to the Contacts panel and focuses the form",
    },
  ];

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {primary.map((p) => (
        <Link
          key={p.label}
          href={p.href}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          + {p.label}
        </Link>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => (o ? null : "more"))}
          aria-expanded={open === "more"}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          + More ▾
        </button>
        {open === "more" && (
          <div
            className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
            onMouseLeave={() => setOpen(null)}
          >
            {more.map((m) => {
              const content = (
                <div className="flex items-start gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">
                  <span className="font-semibold">+ {m.label}</span>
                  {m.hint && (
                    <span className="ml-auto text-[10px] text-neutral-400">
                      {m.disabled ? "—" : ""}
                    </span>
                  )}
                </div>
              );
              if (m.disabled) {
                return (
                  <div
                    key={m.label}
                    className="cursor-not-allowed opacity-50"
                    title={m.hint}
                  >
                    {content}
                  </div>
                );
              }
              if (m.href) {
                return (
                  <Link
                    key={m.label}
                    href={m.href}
                    onClick={() => setOpen(null)}
                    title={m.hint}
                    className="block"
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => {
                    m.onClick?.();
                    setOpen(null);
                  }}
                  title={m.hint}
                  className="block w-full"
                >
                  {content}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
