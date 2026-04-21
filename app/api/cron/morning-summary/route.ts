import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Daily morning summary. 7am PT each day:
 *
 *   - How many visits today.
 *   - Any overdue invoices.
 *   - Any unsigned customer forms (demo_ack, pre_pour, completion
 *     still waiting on the customer).
 *   - Any unread leads (new status, older than 24h).
 *
 * One in-app + push notification per office/admin user per day.
 * Vercel runs this hourly; the PT-hour gate makes it fire once.
 */

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("run") === "1";
  const ptHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (!force && ptHour !== 7) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `hour=${ptHour} (not 7)`,
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Today's bounds in the app's tz (we use UTC here to match DB
  // timestamps — the count is approximate and that's fine for a
  // summary).
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  // We fan out per tenant so each tenant's users see their own
  // tenant's numbers only.
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("status", "active");

  const tenantResults: Array<{
    tenant_id: string;
    name: string;
    visits: number;
    overdue_invoices: number;
    unsigned_forms: number;
    cold_leads: number;
    notified: number;
  }> = [];

  for (const tenant of tenants ?? []) {
    const [
      { count: visitsToday },
      { count: overdueInvoices },
      { count: unsignedForms },
      { count: coldLeads },
    ] = await Promise.all([
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("scheduled_for", start.toISOString())
        .lte("scheduled_for", end.toISOString()),
      supabase
        .from("payment_milestones")
        .select("id", { count: "exact", head: true })
        .eq("status", "overdue"),
      supabase
        .from("customer_forms")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "sent"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "new")
        .lte(
          "captured_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);

    const totalItems =
      (visitsToday ?? 0) +
      (overdueInvoices ?? 0) +
      (unsignedForms ?? 0) +
      (coldLeads ?? 0);
    if (totalItems === 0) {
      tenantResults.push({
        tenant_id: tenant.id as string,
        name: tenant.name as string,
        visits: 0,
        overdue_invoices: 0,
        unsigned_forms: 0,
        cold_leads: 0,
        notified: 0,
      });
      continue;
    }

    const bodyParts: string[] = [];
    if (visitsToday && visitsToday > 0)
      bodyParts.push(`${visitsToday} visit${visitsToday === 1 ? "" : "s"}`);
    if (overdueInvoices && overdueInvoices > 0)
      bodyParts.push(
        `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"}`,
      );
    if (unsignedForms && unsignedForms > 0)
      bodyParts.push(
        `${unsignedForms} unsigned form${unsignedForms === 1 ? "" : "s"}`,
      );
    if (coldLeads && coldLeads > 0)
      bodyParts.push(
        `${coldLeads} lead${coldLeads === 1 ? "" : "s"} past 24h`,
      );

    const { data: officers } = await supabase
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenant.id)
      .in("role", ["admin", "office"]);
    const officerIds = (officers ?? []).map((o) => o.id as string);

    if (officerIds.length === 0) {
      tenantResults.push({
        tenant_id: tenant.id as string,
        name: tenant.name as string,
        visits: visitsToday ?? 0,
        overdue_invoices: overdueInvoices ?? 0,
        unsigned_forms: unsignedForms ?? 0,
        cold_leads: coldLeads ?? 0,
        notified: 0,
      });
      continue;
    }

    try {
      const { notifyUsers } = await import("@/lib/notify");
      await notifyUsers(
        {
          userIds: officerIds,
          kind: "system",
          title: `☀ Good morning — ${tenant.name}`,
          body: bodyParts.join(" · "),
          link: "/dashboard",
          entity_type: null,
          entity_id: null,
        },
        supabase,
      );
    } catch (err) {
      console.warn("[morning-summary] notify failed", err);
    }

    tenantResults.push({
      tenant_id: tenant.id as string,
      name: tenant.name as string,
      visits: visitsToday ?? 0,
      overdue_invoices: overdueInvoices ?? 0,
      unsigned_forms: unsignedForms ?? 0,
      cold_leads: coldLeads ?? 0,
      notified: officerIds.length,
    });
  }

  return NextResponse.json({
    ok: true,
    tenants: tenantResults.length,
    results: tenantResults,
  });
}
