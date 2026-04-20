"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Admin-only update to the `invoice_settings` singleton. Covers the card
 * and ACH processor fees (percent + flat + absorb toggle) plus the check
 * instructions shown on the public pay page.
 */

export type UpdateResult =
  | { ok: true }
  | { ok: false; error: string };

function parsePercent(raw: string, label: string): number | string {
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
    return `${label} percent must be between 0 and 100.`;
  }
  return Math.round((pct / 100) * 10000) / 10000; // 4 decimals
}

function parseFlatCents(raw: string, label: string): number | string {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
    return `${label} flat fee must be a non-negative whole number of cents.`;
  }
  return v;
}

export async function updateInvoiceSettings(
  formData: FormData,
): Promise<UpdateResult> {
  await requireRole(["admin"]);

  const ccPct = parsePercent(
    String(formData.get("cc_fee_percent") ?? "").trim(),
    "Credit card",
  );
  if (typeof ccPct === "string") return { ok: false, error: ccPct };
  const ccFlat = parseFlatCents(
    String(formData.get("cc_fee_flat_cents") ?? "").trim(),
    "Credit card",
  );
  if (typeof ccFlat === "string") return { ok: false, error: ccFlat };
  const ccAbsorb = formData.get("cc_fee_absorb") === "on";

  const achPct = parsePercent(
    String(formData.get("ach_fee_percent") ?? "0").trim(),
    "ACH",
  );
  if (typeof achPct === "string") return { ok: false, error: achPct };
  const achFlat = parseFlatCents(
    String(formData.get("ach_fee_flat_cents") ?? "0").trim(),
    "ACH",
  );
  if (typeof achFlat === "string") return { ok: false, error: achFlat };
  const achAbsorb = formData.get("ach_fee_absorb") === "on";

  const checkInstructions = String(
    formData.get("check_instructions") ?? "",
  ).trim();
  if (!checkInstructions) {
    return { ok: false, error: "Check instructions cannot be empty." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_settings")
    .update({
      cc_fee_percent: ccPct,
      cc_fee_flat_cents: ccFlat,
      cc_fee_absorb: ccAbsorb,
      ach_fee_percent: achPct,
      ach_fee_flat_cents: achFlat,
      ach_fee_absorb: achAbsorb,
      check_instructions: checkInstructions,
    })
    .eq("singleton", true);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/invoicing");
  return { ok: true };
}
