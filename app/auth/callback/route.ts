import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { landingPathForRole, type UserRole } from "@/lib/auth";

/**
 * Handles the Supabase magic-link redirect. Supabase can send the user here
 * in two shapes depending on the email template / auth flow:
 *   1. PKCE flow:     ?code=<auth_code>
 *   2. OTP template:  ?token_hash=<hash>&type=magiclink (or email, recovery, ...)
 * We accept both, exchange/verify to set the session cookie, then redirect to
 * the correct landing page for the user's role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
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
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Session cookie is set. Figure out where to land the user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Self-heal: if the handle_new_user trigger never fired for this auth.users
  // row (e.g., user was created before migration 002), the profiles table
  // won't have a row and every downstream requireRole() call will bounce the
  // session back to /login, producing a loop. Calling ensure_current_profile()
  // is idempotent — it's a no-op when a profile already exists.
  const { error: bootstrapError } = await supabase.rpc(
    "ensure_current_profile"
  );
  if (bootstrapError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        `profile_bootstrap_failed: ${bootstrapError.message}`
      )}`
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Should be impossible after ensure_current_profile — but if it happens
    // (e.g., RLS misconfigured), fail loudly instead of silently defaulting
    // to 'crew' and sending the user into another loop.
    return NextResponse.redirect(`${origin}/login?error=profile_missing`);
  }

  const role = profile.role as UserRole;
  const target = next && next.startsWith("/") ? next : landingPathForRole(role);

  return NextResponse.redirect(`${origin}${target}`);
}
