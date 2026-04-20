"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveQuoteAction,
  sendQuoteReminderAction,
} from "../actions";

/**
 * Jobber-style "•••" menu on the quote detail. Wraps the actions that
 * aren't on the main QuoteActions bar: send reminder, archive, print.
 * Print opens the public quote page in a new tab (browser handles the
 * print dialog).
 */
export function QuoteMoreMenu({
  quoteId,
  publicUrl,
}: {
  quoteId: string;
  publicUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  function runArchive() {
    setMsg(null);
    if (!confirm("Archive this quote? It'll stop showing in the pipeline.")) {
      return;
    }
    start(async () => {
      await archiveQuoteAction(quoteId);
      setOpen(false);
      router.refresh();
    });
  }

  function runReminder() {
    setMsg(null);
    start(async () => {
      const res = await sendQuoteReminderAction(quoteId);
      if (res.ok) {
        setMsg(
          res.sent
            ? "Reminder text sent."
            : res.skip
              ? "Logged (OpenPhone not wired)."
              : "Sent.",
        );
      } else {
        setMsg(res.error);
      }
    });
  }

  function runPrint() {
    setOpen(false);
    window.open(publicUrl, "_blank", "noopener");
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      >
        •••
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <button
            type="button"
            onClick={runReminder}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
          >
            📱 Send reminder SMS
          </button>
          <button
            type="button"
            onClick={runPrint}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
          >
            🖨 Print / PDF
          </button>
          <button
            type="button"
            onClick={runArchive}
            disabled={pending}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            📦 Archive
          </button>
        </div>
      )}
      {msg && (
        <p className="absolute right-0 top-full mt-12 text-[11px] text-neutral-600">
          {msg}
        </p>
      )}
    </div>
  );
}
