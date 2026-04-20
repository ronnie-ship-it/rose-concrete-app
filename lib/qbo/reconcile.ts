/**
 * QBO ↔ payment_milestones reconciliation.
 *
 * Pure function — no network, no Supabase client construction. Takes the
 * milestones and a QBO adapter, returns the set of updates to apply. The
 * cron route and any future webhook handler both call this so the business
 * logic has one home.
 *
 * The adapter is intentionally small: given a QBO invoice id, return the
 * payment state the app cares about. When real QBO API creds show up
 * (QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_REFRESH_TOKEN), replace the stub
 * adapter with a real one — the calling code doesn't change.
 */

export type QboPaymentState = {
  invoice_id: string;
  /** Amount QBO reports as received against this invoice, in dollars. */
  amount_received: number;
  /** Total billed on the invoice, in dollars. */
  amount_total: number;
  /** First payment id (used as qbo_payment_id on the milestone). */
  first_payment_id: string | null;
  /** Timestamp of the first payment, if any. */
  first_payment_at: string | null;
};

export type QboAdapter = {
  getInvoicePaymentState(
    invoiceId: string
  ): Promise<QboPaymentState | null>;
};

export type MilestoneForReconcile = {
  id: string;
  schedule_qbo_invoice_id: string | null;
  amount: number;
  status: string;
  qbo_payment_id: string | null;
};

export type ReconcileUpdate = {
  milestone_id: string;
  status: "paid";
  qbo_payment_id: string;
  qbo_paid_amount: number;
  qbo_paid_at: string;
  receipt_pending: true;
};

export type ReconcileResult = {
  checked: number;
  updates: ReconcileUpdate[];
  skipped_no_invoice: number;
  skipped_already_paid: number;
};

/**
 * For each milestone whose schedule has a QBO invoice linked, ask the
 * adapter if that invoice has been paid. If yes and we haven't already
 * recorded it, emit an update. We intentionally flip status directly to
 * "paid" without attempting partial-payment bookkeeping — Rose Concrete
 * currently invoices one milestone per invoice, so "invoice paid" ↔
 * "milestone paid".
 */
export async function reconcileMilestones(
  milestones: MilestoneForReconcile[],
  adapter: QboAdapter
): Promise<ReconcileResult> {
  const updates: ReconcileUpdate[] = [];
  let skipped_no_invoice = 0;
  let skipped_already_paid = 0;

  for (const m of milestones) {
    if (!m.schedule_qbo_invoice_id) {
      skipped_no_invoice++;
      continue;
    }
    if (m.status === "paid" && m.qbo_payment_id) {
      skipped_already_paid++;
      continue;
    }

    const state = await adapter.getInvoicePaymentState(
      m.schedule_qbo_invoice_id
    );
    if (!state || !state.first_payment_id) continue;

    // Treat fully-paid invoices as "this milestone is paid".
    if (state.amount_received + 0.01 >= state.amount_total) {
      updates.push({
        milestone_id: m.id,
        status: "paid",
        qbo_payment_id: state.first_payment_id,
        qbo_paid_amount: state.amount_received,
        qbo_paid_at: state.first_payment_at ?? new Date().toISOString(),
        receipt_pending: true,
      });
    }
  }

  return {
    checked: milestones.length,
    updates,
    skipped_no_invoice,
    skipped_already_paid,
  };
}

/**
 * Stub adapter used until QBO API creds are wired. Always returns null so
 * the reconcile loop does nothing harmful. The cron route surfaces the
 * "not configured" state so nobody thinks the job is running.
 */
export function createStubQboAdapter(): QboAdapter {
  return {
    async getInvoicePaymentState() {
      return null;
    },
  };
}

/**
 * Real adapter factory — call when QBO creds are configured. Left as a
 * stub body for now so the typing is exercised; swap in real HTTP calls
 * once the refresh-token flow is implemented.
 */
export function createQboApiAdapter(_opts: {
  realm_id: string;
  access_token: string;
}): QboAdapter {
  return {
    async getInvoicePaymentState(_invoiceId) {
      // TODO: GET https://quickbooks.api.intuit.com/v3/company/{realm_id}/invoice/{invoiceId}
      //   → parse Balance, TotalAmt, LinkedTxn[].TxnId (Payment)
      // Then: GET .../payment/{paymentId} → TxnDate
      return null;
    },
  };
}
