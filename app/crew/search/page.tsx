import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { SearchUI } from "./search-ui";

export const metadata = { title: "Search — Rose Concrete" };

type SearchParams = Promise<{ q?: string; kind?: string }>;

/**
 * Crew search — Jobber mobile parity.
 *
 *   Filter pills:  [Clients] [Requests] [Quotes] [Jobs]
 *   Search box
 *   Recently active list — icon, name, date, address, status pill
 *
 * Single server page that fetches recents and accepts ?q= for live
 * search. The `<SearchUI>` client component handles the debounced
 * input + filter selection and re-navigates to update the URL.
 */
export default async function CrewSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const { q, kind } = await searchParams;
  const query = (q ?? "").trim();
  const activeKind =
    kind === "clients" ||
    kind === "requests" ||
    kind === "quotes" ||
    kind === "jobs"
      ? kind
      : null;

  const supabase = await createClient();

  // Recently active — union across clients / projects / quotes / leads.
  // Cap each at 20 and merge in memory.
  const [clientRes, projectRes, quoteRes, leadRes] = await Promise.all([
    !activeKind || activeKind === "clients"
      ? supabase
          .from("clients")
          .select("id, name, updated_at, city, archived_at")
          .is("archived_at", null)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    !activeKind || activeKind === "jobs"
      ? supabase
          .from("projects")
          .select(
            "id, name, updated_at, status, service_address, client:clients(name)",
          )
          .is("archived_at", null)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    !activeKind || activeKind === "quotes"
      ? supabase
          .from("quotes")
          .select(
            "id, number, issued_at, status, base_total, accepted_total, project:projects(name, client:clients(name))",
          )
          .is("archived_at", null)
          .order("issued_at", { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    !activeKind || activeKind === "requests"
      ? supabase
          .from("leads")
          .select(
            "id, contact_name, captured_at, status, service_address, service_type",
          )
          .is("archived_at", null)
          .order("captured_at", { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  type Row = {
    id: string;
    kind: "client" | "project" | "quote" | "lead";
    label: string;
    subtitle: string | null;
    date: string | null;
    status: string | null;
    href: string;
  };

  const rows: Row[] = [];
  for (const c of clientRes.data ?? []) {
    rows.push({
      id: c.id as string,
      kind: "client",
      label: c.name as string,
      subtitle: (c.city as string | null) ?? null,
      date: (c.updated_at as string | null) ?? null,
      status: null,
      href: `/crew/clients/${c.id}`,
    });
  }
  for (const p of projectRes.data ?? []) {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    rows.push({
      id: p.id as string,
      kind: "project",
      label: p.name as string,
      subtitle:
        [(client as { name?: string } | null)?.name, p.service_address]
          .filter(Boolean)
          .join(" · ") || null,
      date: (p.updated_at as string | null) ?? null,
      status: p.status as string | null,
      href: `/crew/projects/${p.id}`,
    });
  }
  for (const q of quoteRes.data ?? []) {
    const project = Array.isArray(q.project) ? q.project[0] : q.project;
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null;
    rows.push({
      id: q.id as string,
      kind: "quote",
      label: `Quote #${q.number}`,
      subtitle:
        [client?.name, project?.name].filter(Boolean).join(" · ") || null,
      date: (q.issued_at as string | null) ?? null,
      status: q.status as string | null,
      href: `/crew/quotes/${q.id}`,
    });
  }
  for (const l of leadRes.data ?? []) {
    rows.push({
      id: l.id as string,
      kind: "lead",
      label: (l.contact_name as string | null) ?? "New lead",
      subtitle:
        [l.service_type, l.service_address].filter(Boolean).join(" · ") || null,
      date: (l.captured_at as string | null) ?? null,
      status: l.status as string | null,
      href: `/dashboard/requests#lead-${l.id}`,
    });
  }

  // Text filter + sort by date (newest first).
  const filtered = query
    ? rows.filter(
        (r) =>
          r.label.toLowerCase().includes(query.toLowerCase()) ||
          (r.subtitle ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : rows;
  filtered.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0;
    const bd = b.date ? new Date(b.date).getTime() : 0;
    return bd - ad;
  });

  return <SearchUI initialQuery={query} activeKind={activeKind} rows={filtered} />;
}
