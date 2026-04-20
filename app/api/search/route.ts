import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Cross-entity autosuggest search for the Jobber-style top-bar search.
 * Authenticated users hitting `?q=foo` get up to 5 hits per entity
 * across clients, projects, quotes, and requests. Keep the response
 * small and the round-trip fast — the header component re-fires on
 * every keystroke (debounced client-side).
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      clients: [],
      projects: [],
      quotes: [],
      requests: [],
    });
  }
  const pattern = `%${q.replace(/[%_]/g, "")}%`;

  const supabase = await createClient();
  const [clientsRes, projectsRes, quotesRes, leadsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, phone, email, city")
      .or(
        `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`,
      )
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("projects")
      .select("id, name, status, service_address, client:clients(name)")
      .or(`name.ilike.${pattern},service_address.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("quotes")
      .select(
        "id, number, status, accepted_total, project:projects(name, client:clients(name))",
      )
      .or(`number.ilike.${pattern},title.ilike.${pattern}`)
      .order("issued_at", { ascending: false })
      .limit(5),
    supabase
      .from("leads")
      .select(
        "id, contact_name, contact_phone, contact_email, service_address, status, captured_at",
      )
      .or(
        `contact_name.ilike.${pattern},contact_phone.ilike.${pattern},contact_email.ilike.${pattern},service_address.ilike.${pattern}`,
      )
      .order("captured_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    ok: true,
    clients: (clientsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      meta: [c.phone, c.email, c.city].filter(Boolean).join(" · "),
    })),
    projects: ((projectsRes.data ?? []) as Array<{
      id: string;
      name: string;
      status: string;
      service_address: string | null;
      client: { name: string } | { name: string }[] | null;
    }>).map((p) => {
      const c = Array.isArray(p.client) ? p.client[0] : p.client;
      return {
        id: p.id,
        name: p.name,
        meta: [c?.name, p.service_address, p.status].filter(Boolean).join(" · "),
      };
    }),
    quotes: ((quotesRes.data ?? []) as Array<{
      id: string;
      number: string;
      status: string;
      accepted_total: number | string | null;
      project:
        | {
            name: string;
            client: { name: string } | { name: string }[] | null;
          }
        | {
            name: string;
            client: { name: string } | { name: string }[] | null;
          }[]
        | null;
    }>).map((q) => {
      const p = Array.isArray(q.project) ? q.project[0] : q.project;
      const c = p
        ? Array.isArray(p.client)
          ? p.client[0]
          : p.client
        : null;
      return {
        id: q.id,
        name: q.number,
        meta: [c?.name, p?.name, q.status].filter(Boolean).join(" · "),
      };
    }),
    requests: (leadsRes.data ?? []).map((l) => ({
      id: l.id,
      name: l.contact_name ?? l.contact_phone ?? l.contact_email ?? "Request",
      meta: [l.service_address, l.status].filter(Boolean).join(" · "),
    })),
  });
}
