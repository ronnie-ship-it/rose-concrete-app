import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui";
import { ReplyForm } from "./reply-form";
import { markThreadReadAction } from "./actions";

export const metadata = { title: "Conversation — Rose Concrete" };

type Params = Promise<{ clientId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  await requireRole(["admin", "office"]);
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone, email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  // Don't select `subject` — see note on /dashboard/messages/page.tsx.
  const { data: messages } = await supabase
    .from("communications")
    .select(
      "id, direction, channel, body, started_at, read_at, phone_number, duration_s, was_missed, recording_url"
    )
    .eq("client_id", clientId)
    .order("started_at", { ascending: true })
    .limit(500);

  // Mark inbound unread as read on view. Service role so it bypasses the
  // update policy for non-admin office reads.
  const service = createServiceRoleClient();
  await service
    .from("communications")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("read_at", null)
    .eq("direction", "inbound");

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle={`${client.phone ?? ""} ${client.email ? `· ${client.email}` : ""}`.trim()}
        actions={
          <Link
            href="/dashboard/messages"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← Inbox
          </Link>
        }
      />

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        {(messages ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(messages ?? []).map((m) => (
              <li
                key={m.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.direction === "outbound"
                    ? "ml-auto bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-900"
                }`}
              >
                {m.channel === "call" ? (
                  <p className="italic">
                    📞 {m.direction === "inbound" ? "Incoming" : "Outgoing"} call
                    {m.duration_s ? ` · ${m.duration_s}s` : ""}
                    {m.was_missed ? " · missed" : ""}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap">{m.body}</p>
                )}
                <p
                  className={`mt-1 text-[10px] ${
                    m.direction === "outbound"
                      ? "text-brand-100"
                      : "text-neutral-500"
                  }`}
                >
                  {new Date(m.started_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}

        <ReplyForm clientId={clientId} phone={client.phone} />
      </div>

      {/* Mark-read form is inlined as an <a> form so the user can reopen it
          to clear badges when they go back to inbox. The server action
          above already marked things read, this is just a safety net. */}
      <form action={markThreadReadAction.bind(null, clientId)}>
        <input type="hidden" name="noop" />
      </form>
    </div>
  );
}
