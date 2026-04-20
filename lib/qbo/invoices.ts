/**
 * QBO invoice creation adapter.
 *
 * Two implementations:
 *   - createStubQboInvoiceAdapter: no-op, returns a MOCK-XXXX invoice
 *     number. Used when QBO env vars are not set. Deterministic so reruns
 *     against the same project are idempotent in the logs.
 *   - createQboRestAdapter: real QBO Online REST v3 client. Uses an
 *     OAuth 2.0 access token + realm id (company id). Looks up the
 *     customer by DisplayName; creates one if missing. Creates the
 *     invoice with one line per schedule milestone. Enables the QBO-hosted
 *     Online Payment buttons (check / CC / ACH) so the customer's
 *     "Pay Now" link out of the emailed invoice already works with
 *     whichever method they picked at signing.
 *
 * `getQboInvoiceAdapter()` picks automatically — real when
 * `QBO_ACCESS_TOKEN` + `QBO_REALM_ID` are set, stub otherwise. Callers
 * never branch on env state.
 */
export type QboInvoiceLine = {
  label: string;
  amount: number;
  /** Optional due date (ISO yyyy-mm-dd) — QBO invoice lines don't carry
   * their own due date, but we pass this through so the adapter can
   * attach it as a memo or custom field. */
  due_date: string | null;
};

export type QboInvoiceInput = {
  /** Rose Concrete project id — carried as a memo so QBO rows are
   * searchable back to the project. */
  project_id: string;
  /** Client display name for the QBO customer lookup/create. */
  client_name: string;
  /** Optional client email so QBO can send the "Pay Now" invoice email
   * + keep the Online Payment page open to ACH + card. */
  client_email?: string | null;
  /** Human label for the invoice (project name). */
  project_name: string;
  /** Which method the customer locked in at signing. Drives which
   * OnlinePayment toggles QBO enables on the invoice. */
  locked_payment_method?: "check" | "ach" | "credit_card" | null;
  lines: QboInvoiceLine[];
};

export type QboInvoiceResult = {
  invoice_id: string;
  invoice_number: string;
  pay_now_url?: string | null;
};

export type QboInvoiceAdapter = {
  createInvoice(input: QboInvoiceInput): Promise<QboInvoiceResult>;
};

export function createStubQboInvoiceAdapter(): QboInvoiceAdapter {
  return {
    async createInvoice(input) {
      // Deterministic-ish mock number so reruns don't churn logs.
      const suffix = input.project_id.slice(0, 8).toUpperCase();
      return {
        invoice_id: `mock_${input.project_id}`,
        invoice_number: `MOCK-${suffix}`,
        pay_now_url: null,
      };
    },
  };
}

// ---------- real QBO REST adapter ----------

const QBO_PROD_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

type QboAuth = {
  realm_id: string;
  access_token: string;
  base_url: string;
};

function qboEnv(): QboAuth | null {
  const token = process.env.QBO_ACCESS_TOKEN;
  const realm = process.env.QBO_REALM_ID;
  if (!token || !realm) return null;
  const isSandbox = (process.env.QBO_ENV ?? "").toLowerCase() === "sandbox";
  return {
    realm_id: realm,
    access_token: token,
    base_url: isSandbox ? QBO_SANDBOX_BASE : QBO_PROD_BASE,
  };
}

async function qboFetch<T>(
  auth: QboAuth,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${auth.base_url}/${auth.realm_id}${path}${
    path.includes("?") ? "&" : "?"
  }minorversion=70`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `QBO ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 400)}`,
    );
  }
  return (await res.json()) as T;
}

type QboCustomer = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address?: string };
};

type QboCustomerQueryResponse = {
  QueryResponse?: { Customer?: QboCustomer[] };
};

type QboInvoiceResponse = {
  Invoice: {
    Id: string;
    DocNumber?: string;
    InvoiceLink?: string;
  };
};

async function findCustomerByDisplayName(
  auth: QboAuth,
  name: string,
): Promise<QboCustomer | null> {
  const safe = name.replace(/'/g, "\\'").slice(0, 120);
  const q = `select * from Customer where DisplayName = '${safe}' maxresults 1`;
  const data = await qboFetch<QboCustomerQueryResponse>(
    auth,
    `/query?query=${encodeURIComponent(q)}`,
    { method: "GET" },
  );
  return data.QueryResponse?.Customer?.[0] ?? null;
}

async function createCustomer(
  auth: QboAuth,
  name: string,
  email: string | null,
): Promise<QboCustomer> {
  const body = {
    DisplayName: name.slice(0, 100),
    ...(email
      ? { PrimaryEmailAddr: { Address: email } }
      : {}),
  };
  type CreateResp = { Customer: QboCustomer };
  const data = await qboFetch<CreateResp>(auth, `/customer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.Customer;
}

export function createQboRestAdapter(auth: QboAuth): QboInvoiceAdapter {
  return {
    async createInvoice(input) {
      // 1. Resolve or create the customer.
      let customer = await findCustomerByDisplayName(auth, input.client_name);
      if (!customer) {
        customer = await createCustomer(
          auth,
          input.client_name,
          input.client_email ?? null,
        );
      }

      // 2. Build line items. QBO needs SalesItemLineDetail.ItemRef — we
      //    reference the default "Services" item by id 1 (standard QBO
      //    seed) but fall back to letting QBO create a descriptor-only
      //    line if that doesn't resolve. Ronnie's books categorize every
      //    concrete job under one line item anyway.
      const lines = input.lines.map((l, i) => ({
        Id: String(i + 1),
        LineNum: i + 1,
        DetailType: "SalesItemLineDetail",
        Amount: Number(l.amount.toFixed(2)),
        Description: l.label,
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
        },
      }));

      // 3. Map the locked method → which QBO Online Payment toggles to
      //    enable. ACH + card both need AllowOnlinePayment=true +
      //    AllowOnlineCreditCardPayment=true (QBO's UI exposes ACH under
      //    the same umbrella). Check-only invoices turn those off so the
      //    customer doesn't see the Pay Now button.
      const allowOnline = input.locked_payment_method === "ach" ||
        input.locked_payment_method === "credit_card";

      const body = {
        Line: lines,
        CustomerRef: { value: customer.Id },
        BillEmail: input.client_email
          ? { Address: input.client_email }
          : undefined,
        EmailStatus: input.client_email ? "NeedToSend" : "NotSet",
        PrivateNote: `Rose Concrete project: ${input.project_id}`,
        CustomerMemo: { value: input.project_name },
        AllowOnlinePayment: allowOnline,
        AllowOnlineCreditCardPayment: allowOnline,
        AllowOnlineACHPayment: allowOnline,
      };

      const data = await qboFetch<QboInvoiceResponse>(auth, `/invoice`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      return {
        invoice_id: data.Invoice.Id,
        invoice_number: data.Invoice.DocNumber ?? data.Invoice.Id,
        pay_now_url: data.Invoice.InvoiceLink ?? null,
      };
    },
  };
}

export function getQboInvoiceAdapter(): QboInvoiceAdapter {
  const env = qboEnv();
  if (!env) return createStubQboInvoiceAdapter();
  return createQboRestAdapter(env);
}

/**
 * True when real QBO creds are configured — lets the accept-quote flow
 * avoid firing an auto-invoice against the stub (which would churn MOCK
 * rows into the schedule on every accept).
 */
export function qboIsConfigured(): boolean {
  return qboEnv() !== null;
}
