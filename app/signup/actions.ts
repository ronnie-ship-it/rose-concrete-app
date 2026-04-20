"use server";

/**
 * Tenant signup action. Two-step flow:
 *
 *   1. User submits {email, company_name}. We:
 *      a. Write a `pending_tenant_signups` row (service role, bypasses RLS).
 *      b. Send a magic-link email via Supabase auth with
 *         shouldCreateUser=true so the verify step creates the
 *         auth.users row, which fires the handle_new_user() trigger.
 *      c. Trigger reads the pending_tenant_signups row, creates a
 *         fresh tenants row, and promotes the new profile to admin
 *         of that tenant.
 *
 *   2. Magic link → /auth/callback → session → /dashboard.
 *      By the time /dashboard loads, the tenant + profile are both
 *      in place and RLS isolates the new user from every other
 *      contractor's data.
 *
 * If the email is already associated with an existing tenant we just
 * send the magic link without a pending row — that user just logs in.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SignupResult =
  | { ok: true; email: string; newTenant: boolean }
  | { ok: false; error: string };

export async function tenantSignupAction(
  _prev: SignupResult | null,
  fd: FormData,
): Promise<SignupResult> {
  const emailRaw = fd.get("email");
  const nameRaw = fd.get("company_name");
  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const companyName =
    typeof nameRaw === "string" ? nameRaw.trim() : "";

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!companyName || companyName.length < 2) {
    return { ok: false, error: "Enter your company name." };
  }
  if (companyName.length > 120) {
    return { ok: false, error: "Company name is too long (120 char max)." };
  }

  // Does this email already have a profile? If yes, skip the
  // pending_tenant_signups step — they already have a tenant.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const newTenant = !existingProfile;

  if (newTenant) {
    // Record the tenant intent so the trigger picks it up on profile
    // creation. Upsert so double-submits are idempotent.
    const { error: insErr } = await admin
      .from("pending_tenant_signups")
      .upsert({ email, company_name: companyName }, { onConflict: "email" });
    if (insErr) return { ok: false, error: insErr.message };
  }

  // Fire the magic link. Uses the same callback as the login form.
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    // Clean up the pending row so next attempt can retry cleanly.
    if (newTenant) {
      await admin.from("pending_tenant_signups").delete().eq("email", email);
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, email, newTenant };
}
