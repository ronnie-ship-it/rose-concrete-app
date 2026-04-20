import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ClientForm } from "../client-form";
import { updateClientAction, deleteClientAction } from "../actions";
import { DeleteClientButton } from "./delete-button";
import { NotesPanel } from "@/components/notes-panel";
import { loadNotes } from "@/lib/notes-server";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { loadAttachmentsAcross } from "@/lib/attachments";
import { Clickable } from "@/components/clickable";
import { OpenPhoneThread } from "@/components/openphone-thread";
import { money, dateShort } from "@/lib/format";
import { PropertiesPanel } from "./properties-panel";
import { ContactsPanel } from "./contacts-panel";
import { JobberSyncButton } from "./jobber-sync-button";
import { CustomFieldsPanel } from "@/components/custom-fields/panel";
import { loadCustomFieldsFor } from "@/lib/custom-fields";
import { ArchiveClientButton } from "./archive-button";
import { ClientHubButtons } from "./hub-buttons";
import { ClientCreateBar } from "./client-create-bar";

export const metadata = { title: "Client — Rose Concrete" };

type Params = Promise<{ id: string }>;

export default async function ClientDetailPage({ params }: { params: Params }) {
  await requireRole(["admin", "office"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, revenue_cached")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  // Pull quotes + visits across this client's projects so the client page is
  // a true single-pane history (Jobber-parity directive).
  const [{ data: quotes }, { data: visits }, { data: activity }] =
    projectIds.length > 0
      ? await Promise.all([
          supabase
            .from("quotes")
            .select(
              "id, number, status, base_total, accepted_total, issued_at, project_id"
            )
            .in("project_id", projectIds)
            .order("issued_at", { ascending: false })
            .limit(20),
          supabase
            .from("visits")
            .select(
              "id, scheduled_for, status, project_id, project:projects(name)"
            )
            .in("project_id", projectIds)
            .order("scheduled_for", { ascending: false })
            .limit(15),
          supabase
            .from("activity_log")
            .select("id, action, created_at, payload, entity_type, entity_id")
            .or(
              `and(entity_type.eq.client,entity_id.eq.${id}),and(entity_type.in.(project,quote,visit),entity_id.in.(${[
                ...projectIds,
              ].join(",")}))`
            )
            .order("created_at", { ascending: false })
            .limit(20),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const notes = await loadNotes("client", id);
  const customFields = await loadCustomFieldsFor("client", id);

  const [{ data: properties }, { data: contacts }] = await Promise.all([
    supabase
      .from("client_properties")
      .select("id, label, address, city, state, postal_code, notes")
      .eq("client_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_contacts")
      .select(
        "id, contact_type, first_name, last_name, email, phone, is_primary, notes",
      )
      .eq("client_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  // Aggregated files: the client record itself, every project, every
  // quote. That way Ronnie's permit + photo + contract history is one
  // tray, not three hunts.
  const quoteIds = (quotes ?? []).map((q) => q.id);
  const attachments = await loadAttachmentsAcross([
    { entity_type: "client", entity_ids: [id] },
    { entity_type: "project", entity_ids: projectIds },
    { entity_type: "quote", entity_ids: quoteIds },
  ]);

  // Lifetime value = sum of accepted_total across all this client's quotes.
  const lifetimeValue = (quotes ?? []).reduce(
    (sum, q) => sum + Number(q.accepted_total ?? 0),
    0
  );

  // Open balance + paid-to-date + last payment — Jobber's "Client balance
  // summary" block.
  const { data: allMilestones } =
    projectIds.length > 0
      ? await supabase
          .from("payment_milestones")
          .select(
            "amount, total_with_fee, qbo_paid_amount, qbo_paid_at, status, schedule:payment_schedules!inner(project_id)",
          )
          .in("schedule.project_id", projectIds)
      : { data: [] as Array<{
          amount: number;
          total_with_fee: number | null;
          qbo_paid_amount: number | null;
          qbo_paid_at: string | null;
          status: string;
        }> };
  const openBalance = (allMilestones ?? [])
    .filter((m) => ["pending", "due", "overdue", "sent"].includes(m.status))
    .reduce(
      (sum, m) => sum + Number(m.total_with_fee ?? m.amount ?? 0),
      0,
    );
  const paidToDate = (allMilestones ?? [])
    .filter((m) => m.status === "paid")
    .reduce(
      (sum, m) =>
        sum + Number(m.qbo_paid_amount ?? m.total_with_fee ?? m.amount ?? 0),
      0,
    );
  const totalInvoiced = (allMilestones ?? []).reduce(
    (sum, m) => sum + Number(m.total_with_fee ?? m.amount ?? 0),
    0,
  );
  const lastPaymentAt = (allMilestones ?? [])
    .filter((m) => m.qbo_paid_at)
    .map((m) => m.qbo_paid_at as string)
    .sort()
    .slice(-1)[0];

  // Stats strip derived values
  const activeJobsCount = (projects ?? []).filter((p) =>
    ["approved", "scheduled", "active"].includes(p.status),
  ).length;
  const visitsCount = visits?.length ?? 0;
  const lastVisit = (visits ?? []).find((v) => v.status === "completed");
  const nextVisit = (visits ?? []).find(
    (v) => new Date(v.scheduled_for).getTime() >= Date.now(),
  );

  const updateAction = updateClientAction.bind(null, id);
  const deleteAction = deleteClientAction.bind(null, id);

  const address = [
    client.address,
    [client.city, client.state].filter(Boolean).join(", "),
    client.postal_code,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Clients
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">{client.name}</h1>
          <DeleteClientButton action={deleteAction} clientName={client.name} />
        </div>
      </div>

      {client.archived_at && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          This client is archived
          {client.archived_reason ? ` — ${client.archived_reason}` : ""}
          . History is still reachable; they just don't appear in the
          default Clients list.
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {client.phone && (
          <Clickable kind="tel" value={client.phone}>
            {client.phone}
          </Clickable>
        )}
        {client.email && (
          <Clickable kind="mail" value={client.email}>
            {client.email}
          </Clickable>
        )}
        {address && (
          <Clickable kind="map" value={address}>
            {address}
          </Clickable>
        )}
      </div>

      {/* Jobber-parity "+ New X" bar — every creatable record type
          reachable in one click with client_id prefilled. */}
      <ClientCreateBar
        clientId={id}
        primaryProjectId={(projects ?? [])[0]?.id ?? null}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ClientHubButtons clientId={id} />
        <Link
          href={`/dashboard/clients/${id}/statement`}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
        >
          📄 Statement
        </Link>
        <ArchiveClientButton
          clientId={id}
          archivedAt={(client.archived_at as string | null) ?? null}
        />
      </div>

      {/* Jobber-style summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Lifetime value" value={money(lifetimeValue)} />
        <SummaryStat
          label="Open balance"
          value={money(openBalance)}
          tone={openBalance > 0 ? "warning" : "neutral"}
          sub={
            lastPaymentAt
              ? `Last paid ${dateShort(lastPaymentAt)}`
              : "No payments yet"
          }
        />
        <SummaryStat
          label="Active jobs"
          value={String(activeJobsCount)}
          sub={`${(projects ?? []).length} total`}
        />
        <SummaryStat
          label={nextVisit ? "Next visit" : "Last visit"}
          value={
            nextVisit
              ? dateShort(nextVisit.scheduled_for)
              : lastVisit
                ? dateShort(lastVisit.scheduled_for)
                : "—"
          }
          sub={`${visitsCount} on file`}
        />
      </div>

      {/* Balance summary block — Jobber's "Client balance summary" */}
      {totalInvoiced > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Billing summary
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-neutral-500">Total invoiced</dt>
              <dd className="text-lg font-semibold text-neutral-900">
                {money(totalInvoiced)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Paid to date</dt>
              <dd className="text-lg font-semibold text-emerald-700">
                {money(paidToDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Outstanding</dt>
              <dd
                className={`text-lg font-semibold ${
                  openBalance > 0 ? "text-amber-700" : "text-neutral-900"
                }`}
              >
                {money(openBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Last payment</dt>
              <dd className="text-sm font-medium text-neutral-900">
                {lastPaymentAt ? dateShort(lastPaymentAt) : "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Edit
            </h2>
            <ClientForm action={updateAction} initial={client} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ContactsPanel clientId={id} contacts={contacts ?? []} />
            <PropertiesPanel clientId={id} properties={properties ?? []} />
          </div>
          {customFields.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Custom fields
              </h2>
              <CustomFieldsPanel
                entityType="client"
                entityId={id}
                rows={customFields}
              />
            </div>
          )}
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Notes
            </h2>
            <NotesPanel entityType="client" entityId={id} notes={notes} />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Call & text history · OpenPhone
            </h2>
            <OpenPhoneThread clientId={id} />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <AttachmentsPanel
              entityType="client"
              entityId={id}
              attachments={attachments}
              title="Files · client, projects, quotes"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Projects
            </h2>
            {projects && projects.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {projects.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="text-neutral-800 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-xs uppercase tracking-wide text-neutral-500">
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">No projects yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Quotes
            </h2>
            {quotes && quotes.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {quotes.map((q) => {
                  const total =
                    q.accepted_total != null
                      ? Number(q.accepted_total)
                      : Number(q.base_total ?? 0);
                  return (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <Link
                        href={`/dashboard/quotes/${q.id}`}
                        className="font-mono text-xs text-brand-700 hover:underline"
                      >
                        {q.number}
                      </Link>
                      <span className="text-xs text-neutral-500">
                        {q.status} · {money(total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">No quotes yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Recent visits
            </h2>
            {visits && visits.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {visits.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/dashboard/schedule/${v.id}`}
                      className="text-xs text-neutral-800 hover:underline"
                    >
                      {dateShort(v.scheduled_for)}
                    </Link>
                    <span className="text-xs text-neutral-500">{v.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">No visits yet.</p>
            )}
          </div>

          {activity && activity.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Activity
              </h2>
              <ul className="mt-3 space-y-2 text-xs text-neutral-600">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>{(a.action as string).replace(/_/g, " ")}</span>
                    <span className="text-neutral-400">
                      {dateShort(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <JobberSyncButton
            clientId={client.id}
            current={
              (client.jobber_sync_status as
                | "pending"
                | "synced"
                | "excluded"
                | "not_synced"
                | undefined) ?? "not_synced"
            }
          />

          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500 shadow-sm">
            Created {new Date(client.created_at).toLocaleDateString()}
            {client.jobber_id && (
              <div className="mt-1">Jobber ID: {client.jobber_id}</div>
            )}
            {client.jobber_synced_at && (
              <div className="mt-1">
                Last Jobber sync:{" "}
                {new Date(client.jobber_synced_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "warning";
}) {
  const cls =
    tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${cls} p-3 shadow-sm`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}
