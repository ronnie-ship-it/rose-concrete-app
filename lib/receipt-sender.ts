/**
 * Gmail sender adapter for receipt emails. Stubbed until Gmail MCP is
 * wired from a server context (the MCP is agent-facing; a Node cron needs
 * a server-to-server Gmail API client or a webhook relay — we decide that
 * at wire-up time).
 */

export type ReceiptEmail = {
  to: string;
  from: string;
  subject: string;
  body: string;
  // QBO receipt PDF — base64 blob the worker fetched from QBO.
  pdf_attachment: { filename: string; base64: string } | null;
};

export type ReceiptSendResult =
  | { ok: true; message_id: string | null }
  | { ok: false; error: string; skip: boolean };

export type ReceiptSender = {
  send(email: ReceiptEmail): Promise<ReceiptSendResult>;
};

export function createStubReceiptSender(): ReceiptSender {
  return {
    async send() {
      return {
        ok: false,
        error: "Gmail send path not wired — receipt skipped.",
        skip: true,
      };
    },
  };
}

/**
 * QBO receipt PDF fetch — stubbed. Real impl will GET
 * /v3/company/{realm}/download/{paymentId} and return base64. Until then
 * returns null so the sender just emails a plain text receipt.
 */
export async function fetchQboReceiptPdf(
  _qboPaymentId: string
): Promise<{ filename: string; base64: string } | null> {
  return null;
}
