/**
 * "Who uploaded photos today" compliance strip on the project page.
 * Fed by `crew_photo_reminders` rows stamped by the 4pm cron.
 *
 * Green = uploaded N photos before the reminder fired.
 * Amber = zero at reminder time — needs follow-up.
 */
export function PhotoComplianceStrip({
  rows,
}: {
  rows: Array<{
    user_id: string;
    full_name: string | null;
    uploads_at_send: number;
    sent_at: string;
  }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Today&apos;s photo compliance
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Reminders sent at 4:00pm
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        {rows.map((r) => {
          const compliant = r.uploads_at_send > 0;
          return (
            <li
              key={r.user_id}
              className={`flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                compliant
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              <span>{r.full_name ?? "Unknown"}</span>
              <span className="font-normal opacity-75">
                {compliant
                  ? `✓ ${r.uploads_at_send} ${r.uploads_at_send === 1 ? "photo" : "photos"}`
                  : "0 photos — follow up"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
