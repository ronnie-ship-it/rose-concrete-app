"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { normalizePhone } from "@/lib/openphone";

export type PropertyResult = { ok: true } | { ok: false; error: string };

// ---------- Properties ----------

export async function upsertPropertyAction(
  clientId: string,
  _prev: PropertyResult | null,
  fd: FormData,
): Promise<PropertyResult> {
  try {
    await requireRole(["admin", "office"]);
    const id = String(fd.get("id") ?? "") || null;
    const label = String(fd.get("label") ?? "").trim();
    const address = String(fd.get("address") ?? "").trim() || null;
    const city = String(fd.get("city") ?? "").trim() || null;
    const state = String(fd.get("state") ?? "").trim() || "CA";
    const postal_code = String(fd.get("postal_code") ?? "").trim() || null;
    const notes = String(fd.get("notes") ?? "").trim() || null;
    if (!label) return { ok: false, error: "Label is required." };

    const supabase = createServiceRoleClient();
    if (id) {
      const { error } = await supabase
        .from("client_properties")
        .update({ label, address, city, state, postal_code, notes })
        .eq("id", id)
        .eq("client_id", clientId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("client_properties").insert({
        client_id: clientId,
        label,
        address,
        city,
        state,
        postal_code,
        notes,
      });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function deletePropertyAction(
  clientId: string,
  propertyId: string,
): Promise<PropertyResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("client_properties")
      .delete()
      .eq("id", propertyId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

// ---------- Contacts ----------

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function upsertContactAction(
  clientId: string,
  _prev: ContactResult | null,
  fd: FormData,
): Promise<ContactResult> {
  try {
    await requireRole(["admin", "office"]);
    const id = String(fd.get("id") ?? "") || null;
    const contact_type = String(fd.get("contact_type") ?? "").trim() || null;
    const first_name = String(fd.get("first_name") ?? "").trim() || null;
    const last_name = String(fd.get("last_name") ?? "").trim() || null;
    const email = String(fd.get("email") ?? "").trim().toLowerCase() || null;
    const phoneRaw = String(fd.get("phone") ?? "").trim() || null;
    const phone = phoneRaw ? normalizePhone(phoneRaw) ?? phoneRaw : null;
    const is_primary = String(fd.get("is_primary") ?? "") === "on";
    const notes = String(fd.get("notes") ?? "").trim() || null;
    if (!first_name && !last_name && !email && !phone) {
      return {
        ok: false,
        error: "Need at least one field (name / email / phone).",
      };
    }

    const supabase = createServiceRoleClient();

    if (is_primary) {
      // Flip every other contact off-primary first to keep the
      // one-primary invariant without a partial-unique index.
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId);
    }

    if (id) {
      const { error } = await supabase
        .from("client_contacts")
        .update({
          contact_type,
          first_name,
          last_name,
          email,
          phone,
          is_primary,
          notes,
        })
        .eq("id", id)
        .eq("client_id", clientId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("client_contacts").insert({
        client_id: clientId,
        contact_type,
        first_name,
        last_name,
        email,
        phone,
        is_primary,
        notes,
      });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function deleteContactAction(
  clientId: string,
  contactId: string,
): Promise<ContactResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", contactId)
      .eq("client_id", clientId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
