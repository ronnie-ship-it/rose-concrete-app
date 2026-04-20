"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type TeamResult = { ok: true } | { ok: false; error: string };

const ROLES = ["admin", "office", "crew"] as const;
type Role = (typeof ROLES)[number];

export async function updateMemberRoleAction(
  memberId: string,
  role: Role,
): Promise<TeamResult> {
  try {
    const actor = await requireRole(["admin"]);
    if (!(ROLES as readonly string[]).includes(role)) {
      return { ok: false, error: "Invalid role." };
    }
    if (memberId === actor.id && role !== "admin") {
      return {
        ok: false,
        error: "You can't demote yourself — have another admin change your role.",
      };
    }
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", memberId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_log").insert({
      entity_type: "profile",
      entity_id: memberId,
      action: "role_changed",
      actor_id: actor.id,
      payload: { role },
    });

    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update role.",
    };
  }
}

export async function updateMemberNameAction(
  memberId: string,
  fullName: string,
): Promise<TeamResult> {
  try {
    await requireRole(["admin"]);
    const name = fullName.trim().slice(0, 200);
    if (!name) return { ok: false, error: "Name is required." };
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

/**
 * Best-effort invite. Uses Supabase Auth admin API to create a magic-link
 * invite — requires the service-role key (already in use). If the email
 * bounces or Resend fires its own copy, that's fine; we also write a
 * `profiles` row with the chosen role so RLS works the moment the user
 * verifies.
 */
export async function inviteMemberAction(
  _prev: TeamResult | null,
  fd: FormData,
): Promise<TeamResult> {
  try {
    const actor = await requireRole(["admin"]);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const role = String(fd.get("role") ?? "crew") as Role;
    const fullName = String(fd.get("full_name") ?? "").trim() || null;
    if (!email || !/.+@.+\..+/.test(email)) {
      return { ok: false, error: "Valid email required." };
    }
    if (!(ROLES as readonly string[]).includes(role)) {
      return { ok: false, error: "Invalid role." };
    }

    const supabase = createServiceRoleClient();
    // Send a magic-link invite. inviteUserByEmail is the cleanest path —
    // Supabase mails a link that bootstraps the auth.users row on click.
    // If the user already exists, we just idempotently update the profile.
    const { data: invite, error: inviteErr } =
      await supabase.auth.admin.inviteUserByEmail(email);
    const userId =
      invite?.user?.id ??
      // fallback: existing user
      (
        await supabase.auth.admin
          .listUsers()
          .then((r) => r.data.users.find((u) => u.email === email)?.id)
          .catch(() => undefined)
      );
    // Still insert/upsert a profile row so role + full_name are ready the
    // moment the invitee lands.
    if (userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          role,
        },
        { onConflict: "id" },
      );
    }

    await supabase.from("activity_log").insert({
      entity_type: "profile",
      entity_id: userId ?? null,
      action: "member_invited",
      actor_id: actor.id,
      payload: { email, role, error: inviteErr?.message ?? null },
    });

    if (inviteErr) {
      return {
        ok: false,
        error: `Invite email failed: ${inviteErr.message}. Profile row created; user can still magic-link in.`,
      };
    }

    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to invite.",
    };
  }
}

export async function removeMemberAction(
  memberId: string,
): Promise<TeamResult> {
  try {
    const actor = await requireUser();
    await requireRole(["admin"]);
    if (memberId === actor.id) {
      return { ok: false, error: "You can't remove yourself." };
    }
    const supabase = createServiceRoleClient();
    // Delete the profile row (foreign-keyed rows set null or cascade per
    // their own policies). auth.users row stays — if Ronnie wants to
    // fully revoke access, he can delete it from Supabase dashboard or
    // we can add an auth.admin.deleteUser call later.
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    await supabase.from("activity_log").insert({
      entity_type: "profile",
      entity_id: memberId,
      action: "member_removed",
      actor_id: actor.id,
    });
    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
