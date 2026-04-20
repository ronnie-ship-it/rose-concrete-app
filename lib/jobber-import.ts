/**
 * Jobber CSV → Rose Concrete schema mappers.
 *
 * Each mapper is a pure function: takes a row (parseCsv output), returns
 * the insert payload or null if the row can't be mapped (e.g. no name).
 * The import action runs the mapper, then hands the payload to a single
 * `commit` step that upserts with a deterministic dedupe key.
 *
 * Exact column mappings per Thomas's spec (2026-04-14):
 *
 *   Clients CSV → clients
 *     Company / Company name / Business name             [priority 1]
 *     Client name / Client / Customer / Customer name    [priority 2]
 *     Contact / Contact Name / Full Name / Name / Display Name
 *                                                         [priority 3]
 *     ↳ fallback: First Name + Last Name concatenated
 *     → name
 *     (Jobber "Client Contact Info" export has no `Client name` column,
 *      so rows fall through to `Company` or `Contact`.)
 *     Phone / Phone Number / Mobile / Cell / Home / Work / Telephone
 *                         → phone
 *     Email / Email Address
 *                         → email
 *     Billing address / Address / Street Address / Mailing Address
 *     (or Street + City + State + Zip)
 *                         → address
 *     Lead source / Source / Referral source
 *                         → lead_source
 *     Created / Created date / Date Created
 *                         → created_at
 *     Tags / Labels / Categories
 *                         → tags (split on ; or ,)
 *
 *   Jobs CSV → projects
 *     Job #               → external_id (unique)
 *     Client name         → client lookup (by clients.name)
 *     Title               → name
 *     Created date        → created_at
 *     Scheduled start date→ scheduled_start
 *     Closed date         → completed_at
 *     Total revenue       → revenue_cached
 *     Service street+city+ZIP → service_address (joined)
 *
 *   Quotes CSV → quotes
 *     Quote #             → number
 *     Client name         → client lookup → project lookup
 *     Title               → title
 *     Status              → status
 *     Total ($)           → accepted_total / base_total
 *     Required deposit    → deposit_amount
 *     Approved date       → approved_at (also accepted_at if accepted)
 *     Drafted date        → created_at
 *
 *   Visits CSV → visits
 *     Job #               → project lookup (by projects.external_id)
 *     Date                → scheduled_date
 *     Times               → scheduled_time (first token)
 *     Assigned to         → crew lookup (by profiles.full_name)
 *     Visit completed date→ completed_at
 *
 *   Products and Services CSV → line_item_templates
 *     Name                → title
 *     Invoiced $          → unit_price
 *
 * Dedupe: always skip if the natural key already exists (per user spec).
 */

import { parseCsv, pick } from "./csv";

export type MappedClient = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  lead_source: string | null;
  tags: string[];
  created_at: string | null;
};

export type MappedProject = {
  external_id: string | null;
  client_name: string;
  name: string;
  created_at: string | null;
  scheduled_start: string | null;
  completed_at: string | null;
  revenue_cached: number;
  service_address: string | null;
};

export type MappedQuote = {
  number: string;
  client_name: string;
  title: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  total: number;
  deposit_amount: number | null;
  approved_at: string | null;
  created_at: string | null;
};

export type MappedVisit = {
  external_job_id: string | null;
  client_name: string | null;
  scheduled_date: string | null; // YYYY-MM-DD
  scheduled_time: string | null; // HH:MM:SS
  assignee_name: string | null;
  completed_at: string | null;
};

export type MappedLineItem = {
  title: string;
  unit_price: number;
};

export type MappedContact = {
  client_name: string;
  contact_type: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type MappedClientCommunication = {
  client_name: string;
  external_id: string | null;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  email_address: string | null;
  thread_id: string | null;
  started_at: string | null;
};

export type MappedRequest = {
  external_id: string | null;
  client_name: string | null;
  title: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  service_address: string | null;
  service_type:
    | "driveway"
    | "stamped_driveway"
    | "patio"
    | "sidewalk"
    | "rv_pad"
    | "pickleball_court"
    | "repair"
    | "other"
    | null;
  message: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  requested_on: string | null;
  requested_price: number | null;
};

export type MappedFeedback = {
  external_id: string | null;
  client_name: string | null;
  job_number: string | null;
  score: number | null;
  score_type: "nps" | "rating" | "csat" | null;
  comment: string | null;
  feedback_at: string | null;
};

// ---------- helpers ----------

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseDateOnly(raw: string | null): string | null {
  const iso = parseDate(raw);
  return iso ? iso.slice(0, 10) : null;
}

function parseTimeOnly(raw: string | null): string | null {
  if (!raw) return null;
  // "9:00 AM - 11:00 AM" or "09:00" or "9:00 AM" — take the first chunk.
  const first = raw.split(/[-–]/)[0]?.trim() ?? "";
  const m = first.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

function parseMoney(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function mapJobberQuoteStatus(
  raw: string | null
): "draft" | "sent" | "accepted" | "declined" | "expired" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("approved") || s.includes("accepted") || s.includes("won"))
    return "accepted";
  if (s.includes("sent") || s.includes("awaiting")) return "sent";
  if (s.includes("archived") || s.includes("lost") || s.includes("declined"))
    return "declined";
  if (s.includes("expired")) return "expired";
  return "draft";
}

// ---------- mappers ----------

export function mapClientRow(row: Record<string, string>): MappedClient | null {
  // Jobber's client export format has varied across versions and some
  // customers run their own transforms before uploading. Cast a wide net
  // on header aliases — keys are matched against `normalizeHeader` output,
  // so "Full Name" → "full_name", "Email Address" → "email_address", etc.
  //
  // Priority order inside each group: the most specific / unambiguous
  // alias first so a row that happens to carry both (e.g. "Client name"
  // and "Contact Name") picks the primary one.
  //
  // If the name column is missing, fall back to first+last so a CSV with
  // split columns still imports. A row with literally nothing that can
  // serve as a name still returns null (mapper's job is to veto junk).

  // "Client Contact Info" Jobber export (~518 rows Thomas uploaded
  // 2026-04-18) uses `Contact / Company / Lead / Phone / Email / Billing
  // address / Created date / Lead source` with NO `Client name` column.
  // On individual-customer rows `Contact` is the person, `Company` is
  // empty. On business rows `Company` is set and `Contact` is the
  // billing person. Our `clients.name` takes the most-specific thing
  // we know about the row: company (business name) wins when present,
  // else contact (person's name), else any of the legacy aliases.
  const nameDirect = pick(row, [
    "company_name",
    "company",
    "business_name",
    "client_name",
    "client",
    "customer_name",
    "customer",
    "contact",
    "contact_name",
    "full_name",
    "name",
    "display_name",
  ])?.trim();
  const firstName = pick(row, ["first_name", "given_name", "firstname"])?.trim();
  const lastName = pick(row, [
    "last_name",
    "surname",
    "family_name",
    "lastname",
  ])?.trim();
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name = nameDirect || combined || null;
  if (!name) return null;

  const phone = pick(row, [
    "phone",
    "phone_number",
    "primary_phone",
    "main_phone",
    "mobile",
    "mobile_phone",
    "cell",
    "cell_phone",
    "home_phone",
    "work_phone",
    "contact_phone",
    "telephone",
  ]);

  const email =
    pick(row, [
      "email",
      "email_address",
      "primary_email",
      "main_email",
      "contact_email",
      "e_mail",
    ])?.toLowerCase() ?? null;

  // Single-column address aliases. "Billing address" on a Jobber export
  // is already a joined street/city/state, so we take the first hit as-is.
  const singleAddress = pick(row, [
    "billing_address",
    "billing_street",
    "address",
    "street_address",
    "mailing_address",
    "billing_address_street_1",
    "address_line_1",
    "address_1",
    "street",
    "property_address",
    "service_address",
  ]);

  // Fall back to composing from split columns when no joined field exists.
  // Handles exports that ship "Address 1 / City / State / Zip" as four
  // separate columns.
  let address: string | null = singleAddress;
  if (!address) {
    const street = pick(row, [
      "address_line_1",
      "address_1",
      "street_1",
      "street",
      "billing_street_1",
      "billing_address_street_1",
    ]);
    const street2 = pick(row, [
      "address_line_2",
      "address_2",
      "street_2",
      "billing_street_2",
      "billing_address_street_2",
      "unit",
      "suite",
      "apartment",
    ]);
    const city = pick(row, ["city", "billing_city", "town"]);
    const state = pick(row, [
      "state",
      "province",
      "region",
      "billing_state",
      "billing_province",
    ]);
    const zip = pick(row, [
      "zip",
      "zip_code",
      "postal_code",
      "postcode",
      "billing_zip",
      "billing_postal_code",
    ]);
    const composed = [
      [street, street2].filter(Boolean).join(" "),
      [city, state].filter(Boolean).join(", "),
      zip,
    ]
      .filter((p) => p && p.length > 0)
      .join(" ")
      .trim();
    if (composed) address = composed;
  }

  return {
    name,
    phone,
    email,
    address,
    lead_source: pick(row, [
      "lead_source",
      "source",
      "referral_source",
      "how_did_you_hear",
    ]),
    tags: parseTags(pick(row, ["tags", "labels", "categories"])),
    created_at: parseDate(
      pick(row, [
        "created_date",
        "created_at",
        "created",
        "date_created",
        "created_on",
      ]),
    ),
  };
}

export function mapProjectRow(
  row: Record<string, string>
): MappedProject | null {
  // Jobber's jobs CSV has varied over time — "Client name", "Client",
  // "Customer", "Company name" all show up depending on export origin.
  const client_name = pick(row, [
    "client_name",
    "client",
    "customer",
    "customer_name",
    "company_name",
    "company",
  ])?.trim();
  if (!client_name) return null;
  const name =
    pick(row, ["title", "job_title", "name", "job_name", "description"])?.trim() ??
    "Untitled job";
  const streetParts = [
    pick(row, [
      "service_street_1",
      "service_address_street_1",
      "service_street",
      "street_1",
      "service_address_1",
    ]),
    pick(row, ["service_city", "service_address_city", "city"]),
    pick(row, [
      "service_zip",
      "service_zip_code",
      "service_postal_code",
      "zip",
      "postal_code",
    ]),
  ].filter(Boolean);
  const service_address =
    streetParts.length > 0
      ? streetParts.join(", ")
      : pick(row, ["service_address", "property_address", "address"]);

  return {
    // "Job #" normalizes to "job"; some exports use "Job number" → job_number.
    external_id: pick(row, ["job", "job_number", "number", "id", "job_id"]),
    client_name,
    name,
    created_at: parseDate(
      pick(row, ["created_date", "created_at", "drafted_date", "created"])
    ),
    scheduled_start: parseDate(
      pick(row, [
        "scheduled_start_date",
        "scheduled_start",
        "start_date",
        "start",
      ])
    ),
    completed_at: parseDate(
      pick(row, [
        "closed_date",
        "completed_date",
        "completed_at",
        "end_date",
        "closed",
      ])
    ),
    revenue_cached: parseMoney(
      pick(row, ["total_revenue", "total", "revenue", "amount", "invoiced"])
    ),
    service_address,
  };
}

export function mapQuoteRow(row: Record<string, string>): MappedQuote | null {
  const number = pick(row, [
    "quote",
    "quote_number",
    "number",
    "quote_id",
    "id",
  ])?.trim();
  const client_name = pick(row, [
    "client_name",
    "client",
    "customer",
    "customer_name",
    "company_name",
    "company",
  ])?.trim();
  if (!number || !client_name) return null;
  const total = parseMoney(
    pick(row, ["total", "total_amount", "amount", "subtotal"])
  );
  return {
    number,
    client_name,
    title: pick(row, ["title", "name", "description"]),
    status: mapJobberQuoteStatus(pick(row, ["status", "state"])),
    total,
    deposit_amount: (() => {
      const d = pick(row, [
        "required_deposit",
        "deposit",
        "deposit_amount",
        "deposit_total",
      ]);
      return d ? parseMoney(d) : null;
    })(),
    approved_at: parseDate(
      pick(row, ["approved_date", "approved_at", "accepted_date", "accepted_at"])
    ),
    created_at: parseDate(
      pick(row, ["drafted_date", "created_date", "created_at", "drafted"])
    ),
  };
}

export function mapVisitRow(row: Record<string, string>): MappedVisit | null {
  // Jobber's visits CSV uses "Job #" → "job" after normalization; some
  // older exports use "Job number" → "job_number". When Job # is missing
  // we fall back to client name + date.
  const external_job_id =
    pick(row, ["job", "job_number", "number", "job_id"])?.trim() || null;
  const client_name =
    pick(row, ["client_name", "client", "customer", "customer_name"])?.trim() ||
    null;
  if (!external_job_id && !client_name) return null;
  return {
    external_job_id,
    client_name,
    scheduled_date: parseDateOnly(
      pick(row, ["date", "scheduled_date", "visit_date", "start_date"])
    ),
    scheduled_time: parseTimeOnly(
      pick(row, ["times", "time", "scheduled_time", "start_time"])
    ),
    assignee_name: pick(row, ["assigned_to", "assignee", "crew", "team"]),
    completed_at: parseDate(
      pick(row, [
        "visit_completed_date",
        "completed_date",
        "completed_at",
        "end_date",
      ])
    ),
  };
}

export function mapLineItemRow(
  row: Record<string, string>
): MappedLineItem | null {
  const title = pick(row, ["name", "title", "product", "service"])?.trim();
  if (!title) return null;
  return {
    title,
    unit_price: parseMoney(pick(row, ["invoiced", "price", "default_price", "unit_price"])),
  };
}

export function mapContactRow(
  row: Record<string, string>
): MappedContact | null {
  // Jobber's "Client Contact Info" CSV export is actually the master
  // client list — columns are `Contact / Company / Lead / Phone / Email
  // / Billing address / Created date / Lead source` with NO explicit
  // `Client name` column. Accept that format here so the import UI's
  // "6 · Client Contact Info" form parses it correctly; the action
  // (`importContactsAction`) auto-creates the parent client if needed.
  //
  // Priority for the linking client_name: Company (business) → explicit
  // Client name → Contact. Business rows file under the company; the
  // Contact column separately becomes the primary-contact person.
  const client_name = pick(row, [
    "client_name",
    "client",
    "company_name",
    "company",
    "business_name",
    "customer",
    "customer_name",
    "contact",
    "display_name",
    "name",
    "full_name",
  ])?.trim();
  if (!client_name) return null;

  // Person-level fields. Prefer an explicit contact_name/first/last; fall
  // back to splitting the Contact column; then fall back to splitting the
  // row's main name.
  const full =
    pick(row, ["contact_name", "contact", "full_name", "name"])?.trim() ??
    null;
  const first = pick(row, ["first_name", "given_name", "firstname"])?.trim() ?? null;
  const last = pick(row, ["last_name", "surname", "family_name", "lastname"])?.trim() ?? null;
  let fn = first;
  let ln = last;
  if (!fn && !ln && full) {
    const parts = full.split(/\s+/);
    fn = parts[0] ?? null;
    ln = parts.slice(1).join(" ") || null;
  }
  if (!fn && !ln && client_name) {
    const parts = client_name.split(/\s+/);
    if (parts.length >= 2) {
      fn = parts[0] ?? null;
      ln = parts.slice(1).join(" ") || null;
    } else {
      fn = client_name;
    }
  }

  const email =
    pick(row, [
      "email",
      "email_address",
      "primary_email",
      "main_email",
      "contact_email",
      "e_mail",
    ])
      ?.toLowerCase()
      ?.trim() ?? null;
  const phone = pick(row, [
    "phone",
    "phone_number",
    "primary_phone",
    "main_phone",
    "mobile",
    "mobile_phone",
    "cell",
    "cell_phone",
    "home_phone",
    "work_phone",
    "contact_phone",
    "telephone",
  ]);
  if (!email && !phone && !fn && !ln) return null;

  const primaryRaw = pick(row, ["is_primary", "primary"]);
  const is_primary =
    primaryRaw?.toLowerCase() === "true" ||
    primaryRaw?.toLowerCase() === "yes" ||
    primaryRaw === "1";

  return {
    client_name,
    contact_type: pick(row, ["contact_type", "type", "role", "relationship"]),
    first_name: fn,
    last_name: ln,
    email,
    phone,
    is_primary,
    notes: pick(row, ["notes", "note", "comments"]),
  };
}

function mapCommDirection(raw: string | null): "inbound" | "outbound" {
  const s = (raw ?? "").toLowerCase();
  if (
    s.includes("sent") ||
    s.includes("outbound") ||
    s.includes("out") ||
    s.includes("outgoing") ||
    s.includes("from_us")
  )
    return "outbound";
  return "inbound";
}

export function mapClientCommunicationRow(
  row: Record<string, string>
): MappedClientCommunication | null {
  // Jobber's communications exports vary by report; accept the
  // union of column names. "Client / Company / Contact / Customer"
  // all show up as the parent reference depending on which report
  // was used to generate the CSV.
  const client_name = pick(row, [
    "client_name",
    "client",
    "company_name",
    "company",
    "customer",
    "customer_name",
    "contact",
    "contact_name",
    "to_client",
    "from_client",
  ])?.trim();
  if (!client_name) return null;

  const subject = pick(row, [
    "subject",
    "title",
    "email_subject",
    "message_subject",
  ]);
  const body = pick(row, [
    "body",
    "message",
    "content",
    "preview",
    "snippet",
    "email_body",
    "text",
    "note",
    "notes",
  ]);
  if (!subject && !body) return null;

  return {
    client_name,
    external_id: pick(row, [
      "id",
      "communication_id",
      "message_id",
      "external_id",
      "email_id",
      "thread_message_id",
    ]),
    direction: mapCommDirection(
      pick(row, [
        "direction",
        "type",
        "sent_or_received",
        "inbound_or_outbound",
      ]),
    ),
    subject,
    body,
    email_address:
      pick(row, [
        "email",
        "email_address",
        "to",
        "from",
        "contact_email",
        "recipient",
        "sender",
      ])
        ?.toLowerCase()
        ?.trim() ?? null,
    thread_id: pick(row, ["thread_id", "conversation_id", "thread"]),
    started_at: parseDate(
      pick(row, [
        "date",
        "sent_at",
        "received_at",
        "created_at",
        "created_date",
        "timestamp",
        "email_date",
        "sent_date",
      ]),
    ),
  };
}

function mapRequestStatus(
  raw: string | null
): "new" | "contacted" | "qualified" | "converted" | "lost" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("converted") || s.includes("won") || s.includes("completed"))
    return "converted";
  if (s.includes("qualified") || s.includes("scheduled") || s.includes("assessed"))
    return "qualified";
  if (s.includes("contacted") || s.includes("reached")) return "contacted";
  if (s.includes("lost") || s.includes("declined") || s.includes("archived"))
    return "lost";
  return "new";
}

function mapServiceType(
  raw: string | null
):
  | "driveway"
  | "stamped_driveway"
  | "patio"
  | "sidewalk"
  | "rv_pad"
  | "pickleball_court"
  | "repair"
  | "other"
  | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("stamp")) return "stamped_driveway";
  if (s.includes("driveway")) return "driveway";
  if (s.includes("patio")) return "patio";
  if (s.includes("sidewalk") || s.includes("walkway")) return "sidewalk";
  if (s.includes("rv")) return "rv_pad";
  if (s.includes("pickle")) return "pickleball_court";
  if (s.includes("repair") || s.includes("fix") || s.includes("crack"))
    return "repair";
  return "other";
}

export function mapRequestRow(
  row: Record<string, string>
): MappedRequest | null {
  const client_name = pick(row, [
    "client_name",
    "client",
    "customer",
    "customer_name",
  ])?.trim();
  const title = pick(row, ["title", "request_title", "subject", "service"]);
  if (!client_name && !title) return null;

  const priceRaw = pick(row, [
    "requested_price",
    "estimated_price",
    "price",
    "amount",
  ]);

  return {
    external_id: pick(row, [
      "request",
      "request_number",
      "number",
      "id",
      "external_id",
    ]),
    client_name: client_name ?? null,
    title: title ?? null,
    contact_name: pick(row, ["contact_name", "name"]),
    contact_phone: pick(row, ["phone", "contact_phone", "primary_phone"]),
    contact_email: pick(row, ["email", "contact_email", "primary_email"])
      ?.toLowerCase()
      ?.trim() ?? null,
    service_address: pick(row, [
      "service_address",
      "address",
      "property_address",
    ]),
    service_type: mapServiceType(
      pick(row, ["service_type", "service", "request_type"])
    ),
    message: pick(row, ["message", "notes", "description", "details"]),
    status: mapRequestStatus(pick(row, ["status"])),
    requested_on: parseDate(
      pick(row, ["requested_on", "created_date", "created_at", "date"])
    ),
    requested_price: priceRaw ? parseMoney(priceRaw) : null,
  };
}

export function mapFeedbackRow(
  row: Record<string, string>
): MappedFeedback | null {
  const scoreRaw = pick(row, [
    "score",
    "rating",
    "nps",
    "stars",
    "star_rating",
    "review_score",
    "csat",
  ]);
  const comment = pick(row, [
    "comment",
    "feedback",
    "feedback_comment",
    "review",
    "review_text",
    "response",
    "answer",
    "notes",
    "note",
    "body",
    "message",
  ]);
  // Reject only when BOTH are absent. A row with only a score (no text)
  // or only a comment (like a written testimonial without a rating) is
  // still useful — don't drop it.
  if (!scoreRaw && !comment) return null;

  // Score parsing handles "4.5", "9/10", "5 stars", "4 / 5", etc. Pull
  // the first numeric token and round to int (client_feedback.score is
  // int in the DB; decimals would silently fail the insert).
  let score: number | null = null;
  if (scoreRaw) {
    const match = /-?\d+(?:\.\d+)?/.exec(scoreRaw);
    if (match) {
      const n = Number(match[0]);
      if (Number.isFinite(n)) score = Math.round(n);
    }
  }
  let score_type: "nps" | "rating" | "csat" | null = null;
  if (score !== null) {
    // Prefer explicit hints in the header.
    if (pick(row, ["nps"])) score_type = "nps";
    else if (pick(row, ["stars", "star_rating"])) score_type = "rating";
    else if (pick(row, ["csat"])) score_type = "csat";
    // Fall back to value range.
    else if (score >= 1 && score <= 5) score_type = "rating";
    else if (score >= 0 && score <= 10) score_type = "nps";
    else score_type = "csat";
  }

  return {
    external_id: pick(row, [
      "id",
      "feedback_id",
      "external_id",
      "response_id",
      "review_id",
    ]),
    client_name: pick(row, [
      "client_name",
      "client",
      "company_name",
      "company",
      "customer",
      "customer_name",
      "contact",
      "contact_name",
      "name",
    ]),
    job_number: pick(row, [
      "job",
      "job_number",
      "job_id",
      "job_#",
      "work_order",
      "work_order_number",
    ]),
    score,
    score_type,
    comment,
    feedback_at: parseDate(
      pick(row, [
        "date",
        "received_at",
        "submitted_at",
        "created_at",
        "created_date",
        "response_date",
        "review_date",
        "feedback_date",
      ])
    ),
  };
}

// ---------- orchestrator ----------

export type ImportKind =
  | "clients"
  | "jobs"
  | "quotes"
  | "visits"
  | "products"
  | "contacts"
  | "communications"
  | "requests"
  | "feedback";

const MISSING_FIELD_MESSAGE: Record<ImportKind, string> = {
  clients: "client name",
  jobs: "client name",
  quotes: "quote # or client",
  visits: "job #",
  products: "product name",
  contacts: "client name + (email | phone | name)",
  communications: "client name + subject/body",
  requests: "client name or title",
  feedback: "score or comment",
};

export function previewFile(
  kind: ImportKind,
  text: string
): {
  kind: ImportKind;
  total: number;
  valid: number;
  sample: unknown[];
  invalid: { row: number; reason: string }[];
} {
  const rows = parseCsv(text);
  const mapper = {
    clients: mapClientRow,
    jobs: mapProjectRow,
    quotes: mapQuoteRow,
    visits: mapVisitRow,
    products: mapLineItemRow,
    contacts: mapContactRow,
    communications: mapClientCommunicationRow,
    requests: mapRequestRow,
    feedback: mapFeedbackRow,
  }[kind];

  const invalid: { row: number; reason: string }[] = [];
  const mapped: unknown[] = [];
  rows.forEach((r, i) => {
    const m = mapper(r);
    if (!m) {
      invalid.push({
        row: i + 2,
        reason: `Missing required field (${MISSING_FIELD_MESSAGE[kind]})`,
      });
      return;
    }
    mapped.push(m);
  });

  return {
    kind,
    total: rows.length,
    valid: mapped.length,
    sample: mapped.slice(0, 5),
    invalid: invalid.slice(0, 20),
  };
}
