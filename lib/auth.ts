import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "office" | "crew";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

/**
 * Returns the current user + profile, or null if unauthenticated.
 * Does NOT redirect — callers decide what to do when null.
 *
 * Self-healing: if a session exists in auth.users but the public.profiles row
 * is missing (happens to any user whose auth.users row predates migration
 * 002's handle_new_user trigger, or if the trigger ever fails), we call the
 * ensure_current_profile() SECURITY DEFINER RPC once and retry the read.
 * Without this retry, missing-profile users hit an infinite /login → magic
 * link → /login loop because requireUser() treats "no profile" as
 * "not authenticated".
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return profile as SessionUser;

  // Profile missing — try to bootstrap it, then re-read once.
  const { error: bootstrapError } = await supabase.rpc(
    "ensure_current_profile"
  );
  if (bootstrapError) {
    console.error("ensure_current_profile failed", bootstrapError);
    return null;
  }

  const { data: healed } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (healed as SessionUser | null) ?? null;
}

/**
 * Require a signed-in user. Redirects to /login if not.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a user with one of the allowed roles. Admin always allowed.
 * Crew trying to hit office pages → /crew.
 * Office trying to hit crew pages → /dashboard.
 */
export async function requireRole(
  allowed: UserRole[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "admin" || allowed.includes(user.role)) return user;

  if (user.role === "crew") redirect("/crew");
  redirect("/dashboard");
}

/**
 * Pick the landing page appropriate for a user's role.
 */
export function landingPathForRole(role: UserRole): string {
  return role === "crew" ? "/crew" : "/dashboard";
}
