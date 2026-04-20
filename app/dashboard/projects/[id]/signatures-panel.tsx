/**
 * Read-only list of signatures captured for the project's payment
 * schedule or individual milestones. Renders the PNG data URL inline
 * so Ronnie can see exactly what the customer drew, plus name + IP +
 * timestamp for the audit trail, plus a scope badge telling him
 * whether the signature was a schedule-level acceptance or a
 * per-milestone payment authorization.
 */
import { dateShort } from "@/lib/format";

export type SignatureRow = {
  id: string;
  entity_type?: "payment_schedule" | "payment_milestone" | string;
  entity_id?: string;
  signer_name: string;
  png_data_url: string;
  captured_at: string;
  captured_ip: string | null;
};

export function SignaturesPanel({
  signatures,
  milestoneLabelById,
}: {
  signatures: SignatureRow[];
  /** Map of milestone.id → human label, so per-milestone signatures
   *  show which milestone they authorized. */
  milestoneLabelById?: Map<string, string>;
}) {
  if (signatures.length === 0) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Captured signatures
      </h2>
      <ul className="mt-3 space-y-3">
        {signatures.map((s) => {
          const scope =
            s.entity_type === "payment_milestone"
              ? {
                  label:
                    (s.entity_id &&
                      milestoneLabelById?.get(s.entity_id)) ??
                    "Milestone",
                  tone: "bg-emerald-100 text-emerald-900",
                }
              : {
                  label: "Invoice",
                  tone: "bg-neutral-100 text-neutral-800",
                };
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 border-t border-neutral-100 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-start dark:border-brand-700"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {s.signer_name}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${scope.tone}`}
                  >
                    {scope.label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {dateShort(s.captured_at)}
                  {s.captured_ip ? ` · ${s.captured_ip}` : ""}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.png_data_url}
                alt={`Signature of ${s.signer_name}`}
                className="h-20 w-auto max-w-xs rounded border border-neutral-200 bg-white"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
