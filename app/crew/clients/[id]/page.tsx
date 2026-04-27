import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money } from "@/lib/format";
import { AddressLink } from "@/components/address-link";
import { CrewCreateChrome } from "../../create/chrome";

export const metadata = { title: "Client — Rose Concrete" };

type Params = Promise<{ id: string }>;

/**
 * Crew-app client detail. Mobile-friendly summary of a single client
 * — used as the destination for:
 *   - search result rows (client kind)
 *   - the "Add from Contacts" save redirect
 *   - the "Select existing client" pickers in the create flows
 *
 * Renders inside the same chrome we use for create flows so the X
 * back-arrow works and the global crew bottom-nav is hidden. Read-
 * only on this surface; deeper edits still live on /dashboard.
 */
export default async function CrewClientDetail({ params }: { params: Params }) {
  await requireRole(["crew", "admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, name, phone, email, address, city, state, postal_code, source, created_at, archived_at",
    )
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, revenue_cached, service_address")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, number, status, base_total, accepted_total, issued_at, project:projects!inner(client_id)",
    )
    .eq("project.client_id", id)
    .order("issued_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const composedAddress = [
    client.address,
    [client.city, client.state].filter(Boolean).join(", "),
    client.postal_code,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const phoneHref = client.phone
    ? `tel:${String(client.phone).replace(/[^+0-9]/g, "")}`
    : null;
  const emailHref = client.email ? `mailto:${client.email}` : null;

  return (
    <CrewCreateChrome title="Client" saveLabel="Done" saveHref="/crew">
      {/* Profile header */}
      <div className="px-4 pt-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-base font-extrabold text-[#1A7B40]"
            aria-hidden="true"
          >
            {(client.name ?? "?")
              .split(/\s+/)
              .slice(0, 2)
              .map((s: string) => s[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-[#1a2332] dark:text-white">
              {client.name}
            </h1>
            {client.archived_at && (
              <p className="mt-0.5 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                Archived
              </p>
            )}
            {!client.archived_at && (
              <p className="mt-0.5 inline-flex items-center rounded-full bg-[#1A7B40]/15 px-2 py-0.5 text-[10px] font-bold text-[#1A7B40]">
                Active
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick contact actions */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4">
        <ContactPill
          href={phoneHref}
          enabled={Boolean(phoneHref)}
          label="Call"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />
        <ContactPill
          href={emailHref}
          enabled={Boolean(emailHref)}
          label="Email"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          }
        />
        <ContactPill
          href={null}
          enabled={Boolean(composedAddress)}
          label="Map"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
              <circle cx="12" cy="9" r="3" />
            </svg>
          }
          renderAsAddressLink={composedAddress || undefined}
        />
      </div>

      {/* Field grid */}
      <div className="mt-4 px-4">
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
          <FieldRow label="Phone" value={client.phone ?? "—"} />
          <FieldRow label="Email" value={client.email ?? "—"} />
          <FieldRow
            label="Address"
            value={
              composedAddress ? (
                <AddressLink address={composedAddress} showArrow={false} />
              ) : (
                "—"
              )
            }
          />
          <FieldRow label="Lead source" value={client.source ?? "—"} />
        </ul>
      </div>

      {/* Projects */}
      <div className="mt-5 px-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Jobs ({projects?.length ?? 0})
        </h2>
        {!projects || projects.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            No jobs for this client yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/crew/projects/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-[#1A7B40]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                      {p.name}
                    </p>
                    <p className="truncate text-xs capitalize text-neutral-500 dark:text-neutral-400">
                      {p.status?.replace(/_/g, " ") ?? "—"}
                    </p>
                  </div>
                  {Number(p.revenue_cached ?? 0) > 0 && (
                    <p className="shrink-0 text-sm font-bold text-[#1a2332] dark:text-white">
                      {money(Number(p.revenue_cached))}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quotes */}
      <div className="mt-5 px-4 pb-8">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Quotes ({quotes?.length ?? 0})
        </h2>
        {!quotes || quotes.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            No quotes yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {quotes.map((q) => {
              const total = Number(q.accepted_total ?? q.base_total ?? 0);
              return (
                <li key={q.id}>
                  <Link
                    href={`/crew/quotes/${q.id}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D46B7E]/10 text-[#D46B7E]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 4h8l4 4v8M5 4h2v16h12v-2M11 11a2.5 2.5 0 1 0 0 5M13 13l2 2" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                        Quote #{q.number}
                      </p>
                      <p className="truncate text-xs capitalize text-neutral-500 dark:text-neutral-400">
                        {q.status?.replace(/_/g, " ") ?? "draft"}
                      </p>
                    </div>
                    {total > 0 && (
                      <p className="shrink-0 text-sm font-bold text-[#1a2332] dark:text-white">
                        {money(total)}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CrewCreateChrome>
  );
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-sm text-[#1a2332] dark:text-white">
        {value}
      </span>
    </li>
  );
}

function ContactPill({
  href,
  enabled,
  label,
  icon,
  renderAsAddressLink,
}: {
  href: string | null;
  enabled: boolean;
  label: string;
  icon: React.ReactNode;
  renderAsAddressLink?: string;
}) {
  const cls = `flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 text-xs font-bold ${
    enabled
      ? "bg-white text-[#1A7B40] active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
      : "bg-neutral-50 text-neutral-300 dark:border-neutral-700 dark:bg-neutral-800/50"
  }`;
  if (renderAsAddressLink && enabled) {
    return (
      <AddressLink
        address={renderAsAddressLink}
        showArrow={false}
        showPin={false}
        className={cls}
      />
    );
  }
  if (!enabled || !href) {
    return (
      <span className={cls} aria-disabled>
        {icon}
        <span>{label}</span>
      </span>
    );
  }
  return (
    <a href={href} className={cls}>
      {icon}
      <span>{label}</span>
    </a>
  );
}
