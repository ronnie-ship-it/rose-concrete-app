/**
 * Auto-invoice pipeline — called from the quote-accept action.
 *
 * Flow (all inside one Supabase client pass, no network unless QBO is
 * configured):
 *   1. Check feature flag `qbo_auto_invoice`. If off, return `{ok:true,
 *      skipped:"flag_off"}` — callers don't treat this as an error.
 *   2. Check `qboIsConfigured()`. If the real adapter isn't wired, skip
 *      so we don't pollute the schedule with MOCK-XXXX rows.
 *   3. Load the project's payment schedule + milestones. If the schedule
 *      already has a `qbo_invoice_id`, return `{ok:true, skipped:
 *      "already_invoiced"}` — idempotent on retries.
 *   4. Build the invoice lines from the milestones' `total_with_fee`
 *      (falls back to `amount` when fee wasn't locked) so the QBO
 *      invoice total = the signed total to the penny.
 *   5. Create the QBO invoice, stamp the schedule row, write an
 *      activity_log entry.
 *
 * Never throws. Returns a result object so the calling action can log
 * the outcome without failing the accept path — we never want a QBO hiccup
 * to block a customer from accepting their quote.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getQboInvoiceAdapter,
  qboIsConfigured,
  type QboInvoiceLine,
} from "@/lib/qbo/invoices";

export type AutoInvoiceResult =
  | {
      ok: true;
      created: true;
      qbo_invoice_id: string;
      qbo_invoice_number: string;
      pay_now_url: string | null;
    }
  | { ok: true; skipped: "flag_off" | "not_configured" | "already_invoiced" | "no_schedule" }
  | { ok: false; error: string };

export async function autoInvoiceForApprovedQuote(
  projectId: string,
  quoteId: string,
  supabase: SupabaseClient,
): Promise<AutoInvoiceResult> {
  try {
    if (!(await isFeatureEnabled("qbo_auto_invoice"))) {
      return { ok: true, skipped: "flag_off" };
    }
    if (!qboIsConfigured()) {
      return { ok: true, skipped: "not_configured" };
    }

    const { data: schedule } = await supabase
      .from("payment_schedules")
      .select(
        "id, qbo_invoice_id, qbo_invoice_number, milestones:payment_milestones(label, amount, due_date, total_with_fee, sequence)",
      )
      .eq("project_id", projectId)
      .maybeSingle();
    if (!schedule) return { ok: true, skipped: "no_schedule" };
    if (schedule.qbo_invoice_id) {
      return { ok: true, skipped: "already_invoiced" };
    }

    type Ms = {
      label: string;
      amount: number | string;
      due_date: string | null;
      total_with_fee: number | string | null;
      sequence: number;
    };
    const milestones = ((schedule.milestones ?? []) as Ms[])
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    if (milestones.length === 0) {
      return { ok: false, error: "Schedule has no milestones." };
    }

    const lines: QboInvoiceLine[] = milestones.map((m) => ({
      label: m.label,
      amount: Number(m.total_with_fee ?? m.amount),
      due_date: m.due_date,
    }));

    const { data: project } = await supabase
      .from("projects")
      .select("name, client:clients(name, email)")
      .eq("id", projectId)
      .maybeSingle();
    const rawClient = project?.client;
    const client = Array.isArray(rawClient) ? rawClient[0] : rawClient;

    const { data: quote } = await supabase
      .from("quotes")
      .select("locked_payment_method")
      .eq("id", quoteId)
      .maybeSingle();

    const adapter = getQboInvoiceAdapter();
    const invoice = await adapter.createInvoice({
      project_id: projectId,
      project_name: project?.name ?? "Rose Concrete project",
      client_name: client?.name ?? "Customer",
      client_email: client?.email ?? null,
      locked_payment_method:
        (quote?.locked_payment_method as
          | "check"
          | "ach"
          | "credit_card"
          | null
          | undefined) ?? null,
      lines,
    });

    const { error: updErr } = await supabase
      .from("payment_schedules")
      .update({
        qbo_invoice_id: invoice.invoice_id,
        qbo_invoice_number: invoice.invoice_number,
      })
      .eq("id", schedule.id);
    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "invoice_auto_created",
      payload: {
        schedule_id: schedule.id,
        qbo_invoice_id: invoice.invoice_id,
        qbo_invoice_number: invoice.invoice_number,
        pay_now_url: invoice.pay_now_url ?? null,
        milestone_count: milestones.length,
        triggered_by_quote_id: quoteId,
      },
    });

    return {
      ok: true,
      created: true,
      qbo_invoice_id: invoice.invoice_id,
      qbo_invoice_number: invoice.invoice_number,
      pay_now_url: invoice.pay_now_url ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "QBO auto-invoice failed.",
    };
  }
}
