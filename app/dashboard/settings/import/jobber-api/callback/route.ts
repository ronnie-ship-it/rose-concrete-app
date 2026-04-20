import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { exchangeJobberCode } from "@/lib/jobber-api";

/**
 * OAuth 2.0 redirect target. Jobber sends Ronnie here after he clicks
 * "Authorize" with `?code=...&state=...`. We:
 *   1. Require admin (this is in /dashboard so middleware has already
 *      checked session, but we re-check explicitly).
 *   2. Match the `state` against what we stored when saving credentials.
 *   3. Exchange `code + client_id + client_secret + redirect_uri` for a
 *      token pair.
 *   4. Write the tokens onto the same row and clear `pending_state`.
 *   5. Redirect Ronnie back to the parent page so he sees "Connected ✓".
 *
 * Errors are surfaced by setting `last_error` on the row + redirecting
 * back with a query param the page reads.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_PATH = "/dashboard/settings/import/jobber-api";
const REDIRECT_PATH = "/dashboard/settings/import/jobber-api/callback";

export async function GET(request: NextRequest) {
  await requireRole(["admin"]);

  const appBase = process.env.APP_BASE_URL;
  if (!appBase) {
    return NextResponse.redirect(
      new URL(`${PAGE_PATH}?error=APP_BASE_URL+not+set`, request.url)
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent(`Jobber denied: ${errorParam}`)}`,
        request.url
      )
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent("Missing code or state from Jobber.")}`,
        request.url
      )
    );
  }

  const supabase = createServiceRoleClient();
  const { data: row, error: readErr } = await supabase
    .from("jobber_oauth_tokens")
    .select("id, client_id, client_secret, pending_state")
    .eq("pending_state", state)
    .maybeSingle();
  if (readErr) {
    console.error("[jobber-oauth:callback] read row failed", readErr);
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent(`DB read: ${readErr.message}`)}`,
        request.url
      )
    );
  }
  if (!row) {
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent(
          "No pending connection matches that state. Re-enter credentials and try again."
        )}`,
        request.url
      )
    );
  }

  const redirectUri = `${appBase.replace(/\/$/, "")}${REDIRECT_PATH}`;
  const exchange = await exchangeJobberCode({
    clientId: row.client_id,
    clientSecret: row.client_secret,
    code,
    redirectUri,
  });
  if (!exchange.ok) {
    await supabase
      .from("jobber_oauth_tokens")
      .update({ last_error: exchange.error, pending_state: null })
      .eq("id", row.id);
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent(exchange.error)}`,
        request.url
      )
    );
  }

  const { error: writeErr } = await supabase
    .from("jobber_oauth_tokens")
    .update({
      access_token: exchange.tokens.access_token,
      refresh_token: exchange.tokens.refresh_token,
      access_expires_at: exchange.tokens.expires_at,
      pending_state: null,
      last_error: null,
    })
    .eq("id", row.id);
  if (writeErr) {
    console.error("[jobber-oauth:callback] write tokens failed", writeErr);
    return NextResponse.redirect(
      new URL(
        `${PAGE_PATH}?error=${encodeURIComponent(`DB write: ${writeErr.message}`)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(`${PAGE_PATH}?connected=1`, request.url));
}
