import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { landingPathForRole, type UserRole } from "@/lib/auth";

/**
 * Handles the Supabase magic-link redirect. Supabase can send the user here
 * in two shapes depending on the email template / auth flow:
 *   1. PKCE flow:     ?code=<auth_code>
 *   2. OTP template:  ?token_hash=<hash>&type=magiclink (or email, recovery…)
 *
 * Robustness notes (2026-04-19 fix — Vercel deploy was landing users on the
 * marketing apex instead of /dashboard):
 *
 *   - We accept the callback on EITHER host (marketing apex or app.*). The
 *     session cookie has to be set on the host the final redirect points
 *     to, so when we receive the callback on the marketing apex we forward
 *     to the app.* subdomain WITH the code still attached. The app.* copy
 *     of this route then does the actual exchange, which sets the cookie
 *     on app.* where /dashboard can read it.
 *
 *   - If the exchange succeeds on app.*, we ship the user to the role-
 *     appropriate landing path (or a safe same-origin `next` param).
 *
 *   - Errors round-trip to /login with a human-readable query param so
 *     the user isn't silently stuck.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const host = request.headers.get("host") ?? "";

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      `${appOrigin(origin, host)}/login?error=missing_code`,
    );
  }

  // If we're on the marketing apex, forward to the app subdomain WITH
  // the code attached. Session cookies are host-scoped; the exchange
  // must run on app.* for /dashboard to see the session.
  if (isMarketingHost(host)) {
    const forwarded = new URL(url.toString());
    forwarded.host = appHost(host);
    forwarded.protocol = "https:";
    return NextResponse.redirect(forwarded.toString(), { status: 307 });
  }

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        type: type ?? "magiclink",
        token_hash: tokenHash!,
      });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Session cookie is set. Figure out where to land the user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Self-heal: if handle_new_user never fired (old auth.users row
  // pre-migration-002) the profiles lookup below would 404 and every
  // requireRole() call bounces back to /login. ensure_current_profile()
  // is idempotent.
  const { error: bootstrapError } = await supabase.rpc(
    "ensure_current_profile",
  );
  if (bootstrapError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        `profile_bootstrap_failed: ${bootstrapError.message}`,
      )}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(`${origin}/login?error=profile_missing`);
  }

  const role = profile.role as UserRole;
  // `next` is only honored when it's a relative path starting with / —
  // prevents open-redirect abuse via `?next=https://evil.com`.
  const target =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : landingPathForRole(role);

  return NextResponse.redirect(`${origin}${target}`);
}

// ───── host helpers ─────

/** Is this the marketing apex (e.g. sandiegoconcrete.ai or www.)? */
function isMarketingHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h.startsWith("app.")) return false;
  if (h.includes("localhost")) return false;
  if (h.endsWith(".vercel.app")) return false;
  if (h.startsWith("127.0.0.1") || h.startsWith("0.0.0.0")) return false;
  return true;
}

/** Convert the marketing host to the app subdomain. */
function appHost(host: string): string {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return `app.${bare}`;
}

/** Build an origin that's on the app subdomain when applicable. Used for
 *  the "missing_code" redirect so the error lands on /login with the
 *  session cookie scope intact (cookies set on app.* aren't visible to
 *  the marketing apex and vice versa). */
function appOrigin(originFallback: string, host: string): string {
  if (!isMarketingHost(host)) return originFallback;
  return `https://${appHost(host)}`;
}
