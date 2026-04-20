import { dateShort } from "@/lib/format";

/**
 * Jobber-style quote status timeline breadcrumbs.
 *
 * Renders a horizontal step indicator with the six transitions Jobber
 * tracks on the quote detail page: Created → Sent → Viewed → Approved
 * → Converted (on the project side) → Declined/Expired. Each step
 * shows a dot (filled when the transition has fired), the label, and
 * the timestamp when it fired.
 */

type Step = {
  key: string;
  label: string;
  at: string | null;
  tone?: "pass" | "fail";
};

function stateToTone(status: string): "pass" | "fail" | undefined {
  if (status === "declined") return "fail";
  if (status === "expired") return "fail";
  return undefined;
}

export function QuoteTimeline({
  created,
  sent,
  viewed,
  approved,
  converted,
  declined,
  expired,
  status,
}: {
  created: string | null;
  sent: string | null;
  viewed: string | null;
  approved: string | null;
  converted: string | null;
  declined: string | null;
  expired: string | null;
  status: string;
}) {
  const steps: Step[] = [
    { key: "created", label: "Created", at: created },
    { key: "sent", label: "Sent", at: sent },
    { key: "viewed", label: "Viewed", at: viewed },
    { key: "approved", label: "Approved", at: approved },
    { key: "converted", label: "Converted", at: converted },
  ];

  // Terminal failures get their own badge after the main flow.
  const failure: Step | null = declined
    ? { key: "declined", label: "Declined", at: declined, tone: "fail" }
    : expired
      ? { key: "expired", label: "Expired", at: expired, tone: "fail" }
      : null;

  const terminalTone = stateToTone(status);

  return (
    <div className="mt-3">
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
        {steps.map((s, i) => {
          const done = Boolean(s.at);
          const last = i === steps.length - 1;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-neutral-300 bg-white text-neutral-300"
                }`}
                aria-hidden
              >
                {done ? "✓" : ""}
              </span>
              <div>
                <p
                  className={`font-medium ${
                    done ? "text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-neutral-500">
                  {s.at ? dateShort(s.at) : "—"}
                </p>
              </div>
              {!last && (
                <span
                  className={`hidden h-px w-6 sm:inline-block ${
                    done ? "bg-emerald-300" : "bg-neutral-200"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
        {failure && (
          <li className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                terminalTone === "fail"
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-neutral-300 bg-white text-neutral-300"
              }`}
              aria-hidden
            >
              ✗
            </span>
            <div>
              <p className="font-medium text-red-700">{failure.label}</p>
              <p className="text-red-600/70">
                {failure.at ? dateShort(failure.at) : "—"}
              </p>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
