/**
 * Read-only view of the payment_reminders scheduled for a project's
 * milestones. Matches Jobber's "Reminders" tab — grouped by milestone,
 * one row per (channel, offset), status pill, sent_at timestamp.
 *
 * Pausing a milestone's reminders already lives on each MilestoneRow
 * (see milestones-section.tsx / toggleMilestoneReminders). This tab
 * is the audit view — "what's about to get sent, what already went,
 * what bounced."
 */
import { dateShort } from "@/lib/format";
import { StatusPill } from "@/components/ui";

export type ReminderRow = {
  id: string;
  milestone_id: string;
  channel: "email" | "sms";
  offset_days: number;
  scheduled_for: string;
  status: "scheduled" | "sent" | "failed" | "skipped";
  sent_at: string | null;
  error: string | null;
};

export type MilestoneReminders = {
  milestoneId: string;
  milestoneLabel: string;
  dueDate: string | null;
  remindersPaused: boolean;
  reminders: ReminderRow[];
};

export function RemindersPane({
  groups,
}: {
  groups: MilestoneReminders[];
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500">
        No milestones on this project yet. Reminders appear once a
        payment schedule is generated.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section
          key={g.milestoneId}
          className="rounded-lg border border-neutral-200 bg-white shadow-sm"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                {g.milestoneLabel}
              </h3>
              <p className="text-xs text-neutral-500">
                {g.dueDate ? `Due ${g.dueDate}` : "Due on completion"}
              </p>
            </div>
            {g.remindersPaused && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                Paused
              </span>
            )}
          </header>
          {g.reminders.length === 0 ? (
            <p className="px-5 py-4 text-xs text-neutral-500">
              No reminders scheduled.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-2">When</th>
                  <th className="px-5 py-2">Channel</th>
                  <th className="px-5 py-2">Offset</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {g.reminders.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-neutral-100 text-sm"
                  >
                    <td className="px-5 py-2 text-neutral-700">
                      {dateShort(r.scheduled_for)}
                    </td>
                    <td className="px-5 py-2 text-neutral-600">
                      {r.channel === "email" ? "✉ Email" : "💬 SMS"}
                    </td>
                    <td className="px-5 py-2 text-xs text-neutral-500">
                      {r.offset_days === 0
                        ? "On due date"
                        : r.offset_days < 0
                          ? `${Math.abs(r.offset_days)} days before`
                          : `${r.offset_days} days after`}
                    </td>
                    <td className="px-5 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-2 text-xs text-neutral-600">
                      {r.sent_at
                        ? dateShort(r.sent_at)
                        : r.status === "failed" && r.error
                          ? <span className="text-red-700">{r.error}</span>
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
