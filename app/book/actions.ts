"use server";

import { createLead } from "@/lib/leads";

export type BookingResult =
  | { ok: true; leadId: string; smsSent: boolean; emailSent: boolean }
  | { ok: false; error: string };

/**
 * Public online-booking form action. Delegates to the shared
 * `createLead()` helper so the booking form behaves the same as the
 * website webhook — same client upsert, same draft quote, same instant
 * SMS + email, same notifications.
 */
export async function submitBookingAction(
  _prev: BookingResult | null,
  fd: FormData,
): Promise<BookingResult> {
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim() || null;
  const phone = String(fd.get("phone") ?? "").trim() || null;
  const address = String(fd.get("address") ?? "").trim() || null;
  const serviceType = String(fd.get("service_type") ?? "").trim() || null;
  let message = String(fd.get("message") ?? "").trim() || null;
  const productId = String(fd.get("product_id") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!phone && !email)
    return { ok: false, error: "Phone or email required so we can reach you." };

  // If the customer picked a specific service from the dropdown, resolve
  // the product title and prepend it to the message so Ronnie sees it in
  // the lead card without digging into metadata.
  if (productId) {
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase/service");
      const supabase = createServiceRoleClient();
      const { data: product } = await supabase
        .from("line_item_templates")
        .select("title, booking_display_name")
        .eq("id", productId)
        .maybeSingle();
      const label =
        (product?.booking_display_name as string | null)?.trim() ||
        (product?.title as string | null) ||
        null;
      if (label) {
        message = `Requested service: ${label}${message ? `\n\n${message}` : ""}`;
      }
    } catch {
      // Non-fatal — lead still gets captured without the service label.
    }
  }

  const result = await createLead({
    source: "online_booking",
    name,
    phone,
    email,
    address,
    service_type: serviceType,
    message,
  });

  if (!result.ok) {
    console.error("[book] createLead failed", result.error);
    return {
      ok: false,
      error: "Something went wrong. Call us at the number on our website.",
    };
  }

  if (result.duplicate) {
    return {
      ok: true,
      leadId: result.lead_id,
      smsSent: false,
      emailSent: false,
    };
  }

  return {
    ok: true,
    leadId: result.lead_id,
    smsSent: result.responded.sms,
    emailSent: result.responded.email,
  };
}
