"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/app-url";

type SendMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function sendMagicLink(
  _prev: SendMagicLinkResult | null,
  formData: FormData
): Promise<SendMagicLinkResult> {
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const appUrl = await resolveAppUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Include ?next=/dashboard so the callback knows where to land
      // on success. Without it the callback falls back to the role's
      // default landing path, which for admin/office is /dashboard
      // anyway — but being explicit keeps the URL self-documenting.
      emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, email };
}

// ── DEV-ONLY: instant login bypass (no magic link email needed) ──
// REMOVE BEFORE PRODUCTION DEPLOY
//
// Why we don't redirect() from inside the action:
// This action is invoked via `await devLogin()` from a useTransition handler,
// NOT through <form action={devLogin}>. Next.js 15 encodes server-action
// redirects as a payload in the action response and relies on React's action
// dispatcher to follow them. That dispatcher only runs when the action is
// invoked via form-action or useActionState — a bare `await` drops the
// redirect payload on the floor (diagnosed 2026-04-14: middleware logs
// showed the session cookie WAS written but the browser never requested
// /dashboard, because the 303 just went back to /login).
//
// So: the server action writes the session cookie and returns {ok:true},
// and the client uses window.location.assign("/dashboard") to force a
// full-page navigation that cleanly carries the cookie into middleware.

type DevLoginResult = { ok: true } | { ok: false; error: string };

export async function devLogin(): Promise<DevLoginResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "Dev login is only available in development." };
  }

  const adminEmail = "ronnie@sandiegoconcrete.ai";

  // Use the admin/service-role client to generate a magic link token server-side.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: adminEmail,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return {
      ok: false,
      error: linkError?.message ?? "Failed to generate dev login link.",
    };
  }

  // Verify the token on the cookie-based client to establish a real session.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    return { ok: false, error: verifyError.message };
  }

  return { ok: true };
}
