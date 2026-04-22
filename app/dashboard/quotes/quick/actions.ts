"use server";

/**
 * Quick Quote server action — the "Jobber start-here" flow. Lets
 * Ronnie create a quote in seconds without clicking through:
 *
 *    New Project → Save → New Quote → Pick project → Save
 *
 * …which is how the classic /dashboard/quotes/new form worked. The
 * quick flow takes one form submission and:
 *
 *   1. Resolves the client — either by existing `client_id` (picked
 *      from the ClientCombobox) or by creating one inline (name +
 *      phone/email + address).
 *   2. Auto-creates a placeholder Project with a sensible default
 *      name ("<service_type> at <address>" or "<client name> quick
 *      quote" when service_type is blank). Stamps service_address +
 *      service_type + sqft.
 *   3. Creates a Quote linked to that project, with an optional
 *      first line item described by the free-form `scope` field.
 *   4. Redirects straight to the full quote editor so Ronnie can
 *      add more line items / tweak pricing / send.
 *
 * The only hard-required fields are the client identity and the
 * delivery address. Everything else has a sensible default.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { SERVICE_TYPES, type ServiceType } from "@/lib/service-types";

export type QuickQuoteResult =
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export async function createQuickQuoteAction(
  _prev: QuickQuoteResult,
  fd: FormData,
): Promise<QuickQuoteResult> {
  try {
    await requireRole(["admin", "office"]);
    const actor = await requireUser();
    const supabase = createServiceRoleClient();

    // Client — either existing or the inline-created one.
    const clientIdRaw = String(fd.get("client_id") ?? "").trim();
    const clientNameInline = String(fd.get("client_name") ?? "").trim();
    const clientPhoneInline =
      String(fd.get("client_phone") ?? "").trim() || null;
    const clientEmailInline =
      String(fd.get("client_email") ?? "").trim() || null;

    let clientId: string | null = clientIdRaw || null;
    let clientName: string | null = null;
    if (!clientId) {
      if (!clientNameInline) {
        return {
          ok: false,
          error: "Pick an existing client or type a new one.",
          fieldErrors: { client_id: "Client is required." },
        };
      }
      if (!clientPhoneInline && !clientEmailInline) {
        return {
          ok: false,
          error:
            "Phone or email required on the new client so we can reach them.",
          fieldErrors: { client_phone: "Phone or email required." },
        };
      }
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          name: clientNameInline,
          phone: clientPhoneInline,
          email: clientEmailInline,
          address: String(fd.get("address") ?? "").trim() || null,
        })
        .select("id, name")
        .single();
      if (clientErr || !newClient) {
        return {
          ok: false,
          error: clientErr?.message ?? "Failed to create client.",
        };
      }
      clientId = newClient.id as string;
      clientName = newClient.name as string;
    } else {
      // Look up the name so we can compose a decent project name.
      const { data: c } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .maybeSingle();
      clientName = (c?.name as string | null) ?? null;
    }

    // Project fields.
    const address = String(fd.get("address") ?? "").trim();
    if (!address) {
      return {
        ok: false,
        error: "Service address is required.",
        fieldErrors: { address: "Address is required." },
      };
    }
    const serviceTypeRaw = String(fd.get("service_type") ?? "").trim();
    const serviceType: ServiceType | null = (
      SERVICE_TYPES as readonly string[]
    ).includes(serviceTypeRaw)
      ? (serviceTypeRaw as ServiceType)
      : null;
    const sqftRaw = String(fd.get("sqft") ?? "").trim();
    const sqft = sqftRaw && !Number.isNaN(Number(sqftRaw)) ? Number(sqftRaw) : null;

    const projectName = serviceType
      ? `${serviceType} at ${shortAddress(address)}`
      : `${clientName ?? "New"} quick quote`;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        client_id: clientId,
        name: projectName,
        location: address,
        service_address: address,
        service_type: serviceType,
        sqft,
        status: "quoting",
      })
      .select("id")
      .single();
    if (projErr || !project) {
      return {
        ok: false,
        error: projErr?.message ?? "Failed to create project.",
      };
    }

    // Allocate the next quote number (max + 1 — cheap + race-safe
    // enough for single-tenant throughput; upgrade to a sequence if
    // two Ronnies start quoting simultaneously).
    const { data: maxRow } = await supabase
      .from("quotes")
      .select("number")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (maxRow?.number as number | null | undefined) != null
      ? Number(maxRow!.number) + 1
      : 1001;

    // Base scope — first line item. Optional.
    const scope = String(fd.get("scope") ?? "").trim();
    const priceRaw = String(fd.get("price") ?? "").trim();
    const price = priceRaw && !Number.isNaN(Number(priceRaw))
      ? Number(priceRaw)
      : 0;

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .insert({
        project_id: project.id,
        number: nextNumber,
        status: "draft",
        base_total: price,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (quoteErr || !quote) {
      return {
        ok: false,
        error: quoteErr?.message ?? "Failed to create quote.",
      };
    }

    // Seed the first line item if the user typed a scope.
    if (scope) {
      await supabase.from("quote_line_items").insert({
        quote_id: quote.id,
        title: scope.split(/[.\n]/)[0].trim().slice(0, 160) || "Work",
        description: scope.length > 160 ? scope : null,
        quantity: 1,
        unit: "job",
        unit_price: price,
        is_optional: false,
        position: 0,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/projects");
    redirect(`/dashboard/quotes/${quote.id}`);
  } catch (err) {
    // Next's `redirect()` throws a NEXT_REDIRECT error that's caught
    // by the framework — don't swallow it.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NEXT_REDIRECT")) throw err;
    return { ok: false, error: message };
  }
}

/** Truncate a long address for the auto-generated project name. */
function shortAddress(addr: string): string {
  const firstLine = addr.split(/[,\n]/)[0]?.trim() ?? addr;
  return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
}
