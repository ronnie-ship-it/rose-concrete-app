import { notFound } from "next/navigation";
import Link from "next/link";
import { loadHubClient } from "@/lib/hub";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { money, dateShort } from "@/lib/format";
import { HubMessageForm } from "./message-form";
import { HubFileUpload } from "./file-upload";

export const metadata = { title: "Your Rose Concrete dashboard" };

type Params = Promise<{ token: string }>;

/**
 * Client Hub — customer-facing portal at /hub/<token>. Single page by
 * design (customers don't want a navigation puzzle): jobs, open quotes,
 * payments, messages, and file upload all visible at once.
 */
export default async function HubPage({ params }: { params: Params }) {
  const { token } = await params;
  const client = await loadHubClient(token);
  if (!client) notFound();

  const supabase = createServiceRoleClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, scheduled_start, completed_at, location")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const projectIds = (projects ?? []).map((p) => p.id);

  const { data: quotes } = projectIds.length
    ? await supabase
        .from("quotes")
        .select(
          "id, number, status, base_total, public_token, issued_at, project_id"
        )
        .in("project_id", projectIds)
        .order("issued_at", { ascending: false })
    : { data: [] as Array<{ id: string; number: string; status: string; base_total: number; public_token: string; issued_at: string; project_id: string }> };

  // Milestones hang off payment_schedules, which hang off projects. No
  // direct project_id column on payment_milestones. Column names:
  // `label`, `due_date`, `qbo_paid_at`, `pay_token`.
  const { data: schedules } = projectIds.length
    ? await supabase
        .from("payment_schedules")
        .select("id, project_id")
        .in("project_id", projectIds)
    : { data: [] as Array<{ id: string; project_id: string }> };
  const scheduleIds = (schedules ?? []).map((s) => s.id);

  const { data: milestones } = scheduleIds.length
    ? await supabase
        .from("payment_milestones")
        .select(
          "id, label, amount, status, due_date, qbo_paid_at, pay_token, schedule_id"
        )
        .in("schedule_id", scheduleIds)
        .order("due_date", { ascending: true, nullsFirst: false })
    : {
        data: [] as Array<{
          id: string;
          label: string;
          amount: number;
          status: string;
          due_date: string | null;
          qbo_paid_at: string | null;
          pay_token: string;
          schedule_id: string;
        }>,
      };

  // Skip `subject` — arrives with migration 018 (email support).
  const { data: messages } = await supabase
    .from("communications")
    .select("id, direction, channel, body, started_at")
    .eq("client_id", client.id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-lg bg-brand-600 px-6 py-5 text-white shadow-sm">
          <p className="text-sm text-brand-100">Rose Concrete · Client Hub</p>
          <h1 className="mt-1 text-2xl font-bold">
            Welcome back, {client.name}
          </h1>
          <p className="mt-1 text-xs text-brand-100">
            Bookmark this page — it&apos;s private to you.
          </p>
        </header>

        <Section title="Your jobs">
          {(projects ?? []).length === 0 ? (
            <EmptyRow label="No jobs yet." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(projects ?? []).map((p) => (
                <li key={p.id} className="px-4 py-3 text-sm">
                  <p className="font-semibold text-neutral-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {p.location ?? "—"} · {p.status}
                    {p.completed_at
                      ? ` · completed ${dateShort(p.completed_at)}`
                      : p.scheduled_start
                      ? ` · scheduled ${dateShort(p.scheduled_start)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Open quotes">
          {(quotes ?? []).filter((q) => q.status !== "accepted").length === 0 ? (
            <EmptyRow label="No open quotes." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(quotes ?? [])
                .filter((q) => q.status !== "accepted")
                .map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900">
                        Quote #{q.number}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {money(q.base_total)} · {q.status}
                      </p>
                    </div>
                    {q.public_token && (
                      <Link
                        href={`/q/${q.public_token}`}
                        className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600"
                      >
                        View &amp; approve →
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title="Payments">
          {(milestones ?? []).length === 0 ? (
            <EmptyRow label="Nothing to pay right now." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(milestones ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-neutral-900">{m.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {money(m.amount)} ·{" "}
                      {m.status === "paid" && m.qbo_paid_at
                        ? `paid ${dateShort(m.qbo_paid_at)}`
                        : m.due_date
                        ? `due ${dateShort(m.due_date)}`
                        : m.status}
                    </p>
                  </div>
                  {m.status !== "paid" && m.pay_token && (
                    <Link
                      href={`/pay/${m.pay_token}`}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Pay now
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Messages">
          <div className="space-y-3 p-4">
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {(messages ?? []).length === 0 ? (
                <li className="text-sm text-neutral-500">
                  No messages yet. Send us a note below.
                </li>
              ) : (
                (messages ?? []).map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-md p-2 text-xs ${
                      m.direction === "outbound"
                        ? "bg-brand-50 text-brand-900"
                        : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <p className="font-semibold">
                      {m.direction === "outbound" ? "Rose Concrete" : "You"}
                      <span className="ml-2 font-normal text-neutral-500">
                        {dateShort(m.started_at)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))
              )}
            </ul>
            <HubMessageForm token={token} />
          </div>
        </Section>

        <Section title="Send us files">
          <div className="p-4">
            <HubFileUpload token={token} />
          </div>
        </Section>

        <footer className="pt-4 text-center text-xs text-neutral-500">
          Questions? Call Rose Concrete · San Diego, CA
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <h2 className="border-b border-neutral-100 px-4 py-2 text-sm font-semibold text-brand-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="px-4 py-6 text-center text-xs text-neutral-500">{label}</p>
  );
}
