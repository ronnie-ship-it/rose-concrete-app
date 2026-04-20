import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/notes";

/**
 * OpenPhone history widget. Reads from `communications` (populated by
 * a backfill worker once the OpenPhone MCP is wired). Graceful when
 * migration 013 hasn't run: we just show an empty/placeholder state
 * instead of crashing the client page.
 */

type Row = {
  id: string;
  direction: "inbound" | "outbound";
  channel: "call" | "sms";
  phone_number: string;
  started_at: string;
  duration_s: number | null;
  body: string | null;
  transcript: string | null;
  was_missed: boolean;
};

function fmtDuration(s: number | null): string {
  if (!s) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export async function OpenPhoneThread({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communications")
    .select(
      "id, direction, channel, phone_number, started_at, duration_s, body, transcript, was_missed"
    )
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">OpenPhone table not found.</p>
        <p className="mt-1">
          Run <code>migrations/013_communications.sql</code> to enable the
          call/text history feed. Once the OpenPhone MCP is wired, the
          backfill worker will populate this panel automatically.
        </p>
      </div>
    );
  }

  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500">
        No call or text history yet. Incoming calls and texts from OpenPhone
        will land here once the MCP is wired.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`rounded-md border p-2 text-xs ${
            r.was_missed
              ? "border-red-200 bg-red-50"
              : "border-neutral-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-2 text-neutral-600">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
              {r.channel === "call" ? "📞 call" : "💬 sms"} · {r.direction}
            </span>
            {r.was_missed && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                missed
              </span>
            )}
            <span>{timeAgo(r.started_at)}</span>
            {r.channel === "call" && r.duration_s && (
              <span>· {fmtDuration(r.duration_s)}</span>
            )}
            <span className="ml-auto font-mono text-neutral-500">
              {r.phone_number}
            </span>
          </div>
          {r.body && (
            <p className="mt-1 whitespace-pre-wrap text-neutral-800">
              {r.body}
            </p>
          )}
          {r.transcript && (
            <details className="mt-1">
              <summary className="cursor-pointer text-neutral-500">
                Transcript
              </summary>
              <p className="mt-1 whitespace-pre-wrap text-neutral-700">
                {r.transcript}
              </p>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
