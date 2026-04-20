/**
 * QBO expense → Rose Concrete project matching.
 *
 * The Phase 2 plan says: "background sync pulls expense transactions from QBO
 * and matches to projects (by client name + project tag)." This file is the
 * matching half. The ingest half (CSV today, API later) calls `matchExpense`
 * once per row and writes whatever it returns.
 *
 * Rules (in order, first hit wins):
 *
 *   1. If the expense has a QBO customer id and any project has
 *      `projects.qbo_customer_id` equal to it → match 'auto_customer'.
 *      This is the strongest signal and should be used as soon as Ronnie
 *      backfills customer ids on his projects.
 *
 *   2. Fuzzy-match the QBO "Name" / "Customer" field against
 *      `projects.qbo_customer_name` (explicit override) first, then
 *      `clients.name` of the project's client. Uses a normalized token
 *      comparison so "Smith - Driveway", "smith driveway", "SMITH DRIVEWAY"
 *      all collide. We only take the match if EXACTLY ONE active project
 *      matches — multiple matches mean we don't know which project the
 *      expense belongs to and a human needs to pick.
 *
 *   3. Otherwise → 'unmatched'. The row still gets written with
 *      project_id = null so it shows up in the unmatched queue.
 *
 * Not in scope here: the actual DB write. Keep this file side-effect free so
 * it's cheap to unit-test and we can reuse it from a future API-sync cron.
 */

export type ExpenseRow = {
  /** QBO transaction id — used for idempotency on re-import. */
  qboTransactionId: string;
  /** Posting date from QBO. */
  occurredOn: string; // ISO yyyy-mm-dd
  /** Expense account ("Materials — Concrete", "Subcontractors", etc.). */
  category: string | null;
  /** Positive dollars spent. */
  amount: number;
  memo: string | null;
  /** QBO "Name" column — usually a customer or vendor name. */
  rawCustomer: string | null;
  /** QBO customer id if the ingest source has it (API sync will, CSV won't). */
  qboCustomerId?: string | null;
};

export type MatchCandidate = {
  id: string;
  client_id: string;
  qbo_customer_id: string | null;
  qbo_customer_name: string | null;
  clientName: string;
};

export type MatchResult =
  | { projectId: string; source: "auto_customer" | "auto_name" }
  | { projectId: null; source: "unmatched" };

/**
 * Normalize a customer name for fuzzy comparison. Lowercases, strips
 * punctuation, collapses whitespace, and drops Rose-Concrete-specific suffix
 * words Ronnie uses like "driveway", "patio", "pour" — those are almost
 * always project labels, not part of the legal customer name, and leaving
 * them in turns "Smith Driveway" vs "Smith Patio" into a false mismatch.
 */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok && !PROJECT_LABEL_TOKENS.has(tok))
    .sort() // order-insensitive — "Smith John" == "John Smith"
    .join(" ")
    .trim();
}

const PROJECT_LABEL_TOKENS = new Set([
  "driveway",
  "driveways",
  "patio",
  "patios",
  "sidewalk",
  "sidewalks",
  "walkway",
  "walkways",
  "pour",
  "slab",
  "pad",
  "pads",
  "court",
  "pickleball",
  "stamped",
  "rv",
  "project",
  "job",
  "the",
  "and",
  "&",
]);

/**
 * Pure matcher. Takes an expense row and the set of projects it could belong
 * to, returns the chosen project or 'unmatched'. The caller is responsible
 * for loading `candidates` (typically: all projects whose status is not
 * 'done' or 'cancelled', joined with their client).
 */
export function matchExpense(
  row: ExpenseRow,
  candidates: MatchCandidate[]
): MatchResult {
  // Rule 1: strong QBO customer id match.
  if (row.qboCustomerId) {
    const byId = candidates.filter(
      (c) => c.qbo_customer_id && c.qbo_customer_id === row.qboCustomerId
    );
    if (byId.length === 1) {
      return { projectId: byId[0].id, source: "auto_customer" };
    }
    // Multiple projects pointing at the same QBO customer is a valid state
    // (same customer, several jobs) — we can't auto-pick. Fall through to
    // name matching to see if the row has enough detail to disambiguate.
  }

  // Rule 2: fuzzy name match.
  const needle = normalizeName(row.rawCustomer);
  if (!needle) return { projectId: null, source: "unmatched" };

  const byName = candidates.filter((c) => {
    const override = normalizeName(c.qbo_customer_name);
    if (override && override === needle) return true;
    const client = normalizeName(c.clientName);
    return client !== "" && client === needle;
  });

  if (byName.length === 1) {
    return { projectId: byName[0].id, source: "auto_name" };
  }

  return { projectId: null, source: "unmatched" };
}
