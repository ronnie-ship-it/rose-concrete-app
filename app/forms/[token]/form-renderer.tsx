"use client";

/**
 * Renders the customer form items + submit button. Four item kinds:
 *   - acknowledge:      large "I understand" checkbox row
 *   - confirm_initials: confirm row + initials input
 *   - text:             textarea
 *   - signature:        full-width signature pad
 *
 * Mobile-first: checkbox rows are 44px+ tall so a fingertip doesn't
 * miss; the submit button is sticky along the bottom of narrow
 * viewports so the customer doesn't have to scroll back up to find
 * it. Progress counter at the top ("2 of 5 complete") so they know
 * how many items are left without scanning the page.
 *
 * State is all local. On submit we call `submitCustomerFormAction`
 * with the answers + signature png; the action validates required
 * items and returns human-readable errors that land in `error`.
 */
import { useMemo, useState, useTransition } from "react";
import { SignaturePad, type SignatureData } from "@/components/signature-pad";
import type { FormItem } from "@/lib/customer-forms";
import { submitCustomerFormAction, type FormAnswer } from "./actions";

export function FormRenderer({
  token,
  items,
  initialSignerName = "",
}: {
  token: string;
  items: FormItem[];
  initialSignerName?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, FormAnswer>>({});
  const [signerName, setSignerName] = useState(initialSignerName);
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setAnswer(key: string, patch: Partial<FormAnswer>) {
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  // Count required items that are satisfied — drives the progress
  // pill and the submit-button enable state on mobile.
  const required = items.filter((i) => i.required);
  const requiredDone = useMemo(() => {
    let n = 0;
    for (const i of required) {
      const a = answers[i.key] ?? {};
      if (i.kind === "acknowledge" && a.confirmed) n++;
      else if (
        i.kind === "confirm_initials" &&
        a.confirmed &&
        (a.initials ?? "").trim()
      )
        n++;
      else if (i.kind === "text" && (a.value ?? "").trim()) n++;
      else if (i.kind === "signature" && signature?.pngDataUrl) n++;
    }
    return n;
  }, [required, answers, signature]);
  const allDone = requiredDone >= required.length;

  function submit() {
    setError(null);
    const sigItem = items.find((i) => i.kind === "signature");
    const sigRequired = Boolean(sigItem?.required);
    if (sigRequired && (!signature || !signature.pngDataUrl)) {
      setError("Please draw your signature above.");
      // Scroll to the signature pad so the customer sees the prompt
      // on mobile where it might be off-screen.
      if (typeof document !== "undefined") {
        document
          .querySelector("[data-signature-pad]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const effectiveName =
      (signature?.name ?? "").trim() || signerName.trim();
    if (!effectiveName) {
      setError("Please type your full name.");
      return;
    }
    start(async () => {
      const res = await submitCustomerFormAction(
        token,
        effectiveName,
        answers,
        signature?.pngDataUrl ?? null,
      );
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900 shadow-sm">
        <p className="text-base font-semibold">✓ Submitted — thanks.</p>
        <p className="mt-1">
          A copy of your answers is on file with Ronnie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between rounded-md bg-cream/95 px-3 py-2 text-xs font-semibold backdrop-blur">
          <span className="text-neutral-600">
            {requiredDone} of {required.length} required
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{
                width: `${(requiredDone / required.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {items.map((item) => (
        <ItemControl
          key={item.key}
          item={item}
          answer={answers[item.key] ?? {}}
          onChange={(patch) => setAnswer(item.key, patch)}
          onSignatureChange={setSignature}
          initialSignerName={initialSignerName}
        />
      ))}

      {!items.some((i) => i.kind === "signature") && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Your name
          </label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-3 text-base"
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {/* Static inline submit (desktop) */}
      <div className="hidden sm:block">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !allDone}
          className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Sending…" : allDone ? "Submit" : "Complete required items"}
        </button>
      </div>

      {/* Sticky submit (mobile) — pinned to the bottom so the customer
          always has it in reach, with safe-area padding for iOS. */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-4 pb-[env(safe-area-inset-bottom,0)] pt-3 backdrop-blur sm:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 12px)" }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={pending || !allDone}
          className="w-full rounded-md bg-brand-600 px-4 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Sending…" : allDone ? "Submit" : `${requiredDone} of ${required.length} done`}
        </button>
      </div>
    </div>
  );
}

function ItemControl({
  item,
  answer,
  onChange,
  onSignatureChange,
  initialSignerName,
}: {
  item: FormItem;
  answer: FormAnswer;
  onChange: (patch: Partial<FormAnswer>) => void;
  onSignatureChange: (data: SignatureData | null) => void;
  initialSignerName: string;
}) {
  if (item.kind === "acknowledge") {
    const checked = answer.confirmed === true;
    return (
      <label
        className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-sm transition ${
          checked
            ? "border-emerald-300 bg-emerald-50"
            : "border-neutral-200 bg-white"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange({ confirmed: e.target.checked })}
          className="mt-0.5 h-6 w-6 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="flex-1 leading-relaxed text-neutral-800">
          {item.label}
          {item.required && <span className="ml-1 text-red-600">*</span>}
          {item.helper && (
            <span className="mt-1 block text-xs text-neutral-500">
              {item.helper}
            </span>
          )}
        </span>
      </label>
    );
  }
  if (item.kind === "confirm_initials") {
    const checked = answer.confirmed === true;
    return (
      <div
        className={`space-y-3 rounded-xl border p-4 shadow-sm transition ${
          checked && (answer.initials ?? "").trim()
            ? "border-emerald-300 bg-emerald-50"
            : "border-neutral-200 bg-white"
        }`}
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange({ confirmed: e.target.checked })}
            className="mt-0.5 h-6 w-6 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="flex-1 leading-relaxed text-neutral-800">
            {item.label}
            {item.required && <span className="ml-1 text-red-600">*</span>}
          </span>
        </label>
        <div className="flex items-center gap-2 pl-9">
          <span className="text-xs text-neutral-500">Initials</span>
          <input
            type="text"
            value={answer.initials ?? ""}
            onChange={(e) =>
              onChange({ initials: e.target.value.toUpperCase() })
            }
            placeholder="J.D."
            className="w-24 rounded border border-neutral-300 px-2 py-2 text-sm uppercase"
            maxLength={5}
            autoComplete="off"
          />
        </div>
      </div>
    );
  }
  if (item.kind === "text") {
    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {item.label}
          {item.required && <span className="ml-1 text-red-600">*</span>}
        </label>
        <textarea
          value={answer.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-3 text-base shadow-sm"
        />
      </div>
    );
  }
  if (item.kind === "signature") {
    return (
      <div
        data-signature-pad
        className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <p className="mb-3 text-sm font-semibold text-neutral-800">
          {item.label}
          {item.required && <span className="ml-1 text-red-600">*</span>}
        </p>
        <SignaturePad
          onChange={onSignatureChange}
          initialName={initialSignerName}
        />
      </div>
    );
  }
  return null;
}
