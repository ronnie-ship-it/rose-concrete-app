"use client";

/**
 * Read `?saved=…&kind=…` from the URL on /crew and render a brief
 * green confirmation banner that fades after ~3.5s.
 *
 * Keeps the banner appearance state OUT of the server render so the
 * URL change → toast doesn't flash a stale message between
 * navigations. URL params are cleared once the banner mounts so a
 * back-button hit doesn't re-show it.
 *
 * Recognized values:
 *   ?saved=client      → "Client saved ✓"
 *   ?saved=request     → "Request submitted ✓"
 *   ?saved=task        → "Task created ✓"
 *   ?saved=expense     → "Expense logged ✓"
 *   ?saved=visit       → "Visit complete ✓"
 *   ?error=<text>      → red banner with the text
 *
 * Drop into the crew layout's main column once and forget it. Every
 * crew form's redirect path can pass these params freely.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  client: "Client saved",
  request: "Request submitted",
  task: "Task created",
  expense: "Expense logged",
  visit: "Visit updated",
  invoice: "Invoice saved",
  quote: "Quote saved",
  job: "Job saved",
};

export function CrewToast() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);

  useEffect(() => {
    if (!sp) return;
    const saved = sp.get("saved");
    const error = sp.get("error");
    if (saved) {
      setMessage({
        text: `${LABELS[saved] ?? "Saved"} ✓`,
        tone: "ok",
      });
    } else if (error) {
      setMessage({ text: error, tone: "error" });
    } else {
      return;
    }
    // Clear the search params from the URL so a back-button doesn't
    // re-fire the toast. Use replace + the same pathname so we stay
    // put.
    const params = new URLSearchParams(sp.toString());
    params.delete("saved");
    params.delete("error");
    params.delete("kind");
    params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);

    // Auto-dismiss after a beat so the user can keep using the page.
    const handle = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(handle);
  }, [sp, router, pathname]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top, 0) + 56px)" }}
    >
      <div
        className={`flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg ${
          message.tone === "ok" ? "bg-[#1A7B40]" : "bg-[#E0443C]"
        }`}
      >
        <span aria-hidden="true">
          {message.tone === "ok" ? "✓" : "!"}
        </span>
        <span>{message.text}</span>
      </div>
    </div>
  );
}
