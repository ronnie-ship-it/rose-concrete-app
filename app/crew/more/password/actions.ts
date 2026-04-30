"use server";

/**
 * Self-service password change for any crew/admin/office user.
 *
 * `auth.updateUser({ password })` only succeeds when the request
 * carries a valid Supabase session — Supabase scoped the call to the
 * current user, so there's no risk of one user changing another
 * user's password through this action. Admins setting OTHER users'
 * passwords go through the service-role admin API in
 * `app/dashboard/settings/team/actions.ts`.
 *
 * We require the user to type the new password twice to avoid silent
 * typos. The minimum length (8 chars) matches Supabase's default
 * `auth.password_min_length`; if the project ever changes that, the
 * server-side error will surface and we'll bump the constant.
 */
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string };

const MIN_LENGTH = 8;

export async function changePasswordAction(
  _prev: ChangePasswordResult | null,
  formData: FormData,
): Promise<ChangePasswordResult> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_LENGTH} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
