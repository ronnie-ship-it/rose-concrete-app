import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Messages — Rose Concrete" };

/**
 * Unified SMS/email inbox. Lists every client with at least one
 * communication row, sorted by most recent message. Unread count is
 * the number of inbound-without-read_at rows per client.
 */
export default async function MessagesPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // Pull the last 500 recent communications and group client-side so we
  // can render all active threads in one shot. For an office with more
  // than a few dozen active threads this would need server-side grouping;
  // that's a cheap follow-up if Ronnie hits it.
  // Don't select `subject` — that column arrives with migration 018
  // (email support). The inbox works just as well using the `body`
  // preview for both SMS and email once 018 lands.
  const { data: rows } = await supabase
    .from("communications")
    .select(
      "id, client_id, direction, channel, body, started_at, read_at"
    )
    .order("started_at", { ascending: false })
    .limit(500);

  type Thread = {
    clientId: string;
    last: {
      body: string | null;
      started_at: string;
      direction: "inbound" | "outbound";
      channel: "call" | "sms" | "email";
    };
    unread: number;
  };

  const byClient = new Map<string, Thread>();
  for (const r of rows ?? []) {
    if (!r.client_id) continue;
    const prev = byClient.get(r.client_id);
    if (!prev) {
      byClient.set(r.client_id, {
        clientId: r.client_id,
        last: {
          body: r.body ?? null,
          started_at: r.started_at,
          direction: r.direction,
          channel: r.channel,
        },
        unread:
          r.direction === "inbound" && !r.read_at && r.channel !== "call"
            ? 1
            : 0,
      });
    } else if (
      r.direction === "inbound" &&
      !r.read_at &&
      r.channel !== "call"
    ) {
      prev.unread += 1;
    }
  }
  const threadClientIds = Array.from(byClient.keys());

  const { data: clients } =
    threadClientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, name, phone")
          .in("id", threadClientIds)
      : { data: [] as Array<{ id: string; name: string; phone: string | null }> };

  const clientById = new Map(
    (clients ?? []).map((c) => [c.id, c])
  );

  const threads = Array.from(byClient.values()).sort(
    (a, b) =>
      new Date(b.last.started_at).getTime() -
      new Date(a.last.started_at).getTime()
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle={`${threads.length} active conversation${
          threads.length === 1 ? "" : "s"
        }`}
      />

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {threads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No messages yet. Once OpenPhone backfill runs, conversations
            will show up here.
          </p>
        ) : (
          threads.map((t) => {
            const c = clientById.get(t.clientId);
            return (
              <Link
                key={t.clientId}
                href={`/dashboard/messages/${t.clientId}`}
                className="flex items-start justify-between gap-3 px-4 py-3 text-sm transition hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-neutral-900">
                      {c?.name ?? "Unknown"}
                    </p>
                    {t.unread > 0 && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {t.unread}
                      </span>
                    )}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-600">
                      {t.last.channel}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">
                    {t.last.direction === "outbound" ? "You: " : ""}
                    {t.last.body ?? "—"}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] text-neutral-500">
                  {dateShort(t.last.started_at)}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
