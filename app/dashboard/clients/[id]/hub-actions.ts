"use server";

/**
 * Actions on the Client Hub for a specific client:
 *   - sendHubLoginEmailAction: emails the client their /hub/<token>
 *     login link. Jobber's "Send Login Email" button.
 *   - getImpersonationHubUrlAction: returns the URL Ronnie opens to
 *     see exactly what the client sees. Jobber's "Log in as client".
 *     We don't create a new session — we just open the same token URL
 *     the client would get, in a new tab. Safe because the hub token
 *     is already the sole credential needed for the client hub.
 *
 * Both actions require admin-or-office and log to activity_log.
 */
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getEmailAdapter } from "@/lib/email";

export type HubActionResult =
  | { ok: true; message?: string; url?: string }
  | { ok: false; error: string };

async function originFromHeaders(): Promise<string> {
  // Prefer the configured public URL; fall back to x-forwarded-host so
  // previews and custom domains still work.
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "app.sandiegoconcrete.ai";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendHubLoginEmailAction(
  clientId: string,
): Promise<HubActionResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email, hub_token")
      .eq("id", clientId)
      .single();
    if (!client) return { ok: false, error: "Client not found." };
    if (!client.email)
      return {
        ok: false,
        error: "This client has no email on file.",
      };
    if (!client.hub_token)
      return {
        ok: false,
        error:
          "No hub token on this client — rotate the hub link first.",
      };
    const origin = await originFromHeaders();
    const hubUrl = `${origin}/hub/${client.hub_token}`;
    const firstName = (client.name ?? "there").split(/\s+/)[0];
    const adapter = getEmailAdapter();
    if (!adapter.isConfigured()) {
      return {
        ok: false,
        error:
          "Email isn't configured yet (RESEND_API_KEY missing). Copy the hub URL below instead.",
      };
    }
    const res = await adapter.send({
      to: client.email,
      subject: "Your Rose Concrete client hub",
      text: `Hi ${firstName},

Here's your link to the Rose Concrete client hub — you can see your quotes, approve estimates, view invoices, and send us a message anytime:

${hubUrl}

Bookmark it so you always have it handy.

— Ronnie Rose
Rose Concrete · San Diego`,
      tag: "hub_login",
    });
    if (!res.ok) return { ok: false, error: res.error };

    await supabase.from("activity_log").insert({
      entity_type: "client",
      entity_id: clientId,
      action: "hub_login_emailed",
      payload: { to: client.email },
    });
    return {
      ok: true,
      message: `Sent to ${client.email}`,
      url: hubUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/**
 * Returns the hub URL for this client so admin can open it in a new
 * tab. No new session / auth — the hub token itself is the credential
 * the client would use. Logged to activity_log so there's a trail.
 */
export async function getImpersonationHubUrlAction(
  clientId: string,
): Promise<HubActionResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: client } = await supabase
      .from("clients")
      .select("hub_token")
      .eq("id", clientId)
      .single();
    if (!client?.hub_token)
      return {
        ok: false,
        error: "This client doesn't have a hub token yet.",
      };
    const origin = await originFromHeaders();
    await supabase.from("activity_log").insert({
      entity_type: "client",
      entity_id: clientId,
      action: "hub_impersonated",
      payload: { by: user.id },
    });
    return { ok: true, url: `${origin}/hub/${client.hub_token}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
