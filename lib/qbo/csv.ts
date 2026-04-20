/**
 * QBO "Transaction List by Customer" / "Expenses by Vendor Detail" CSV parser.
 *
 * QuickBooks exports these reports with a lot of header cruft (the report
 * title, the company name, the date range, a blank row, and THEN the column
 * header row). This parser skips ahead to the real header row, normalizes
 * column names, and yields one typed row per expense line.
 *
 * Deliberately hand-rolled (no csv-parse dependency) because the shape is
 * narrow, predictable, and we'd rather not add a dep for one use.
 *
 * Side-effect free — does not touch the DB. The server action decides what
 * to do with each row.
 */
import type { ExpenseRow } from "./matching";

export type ParseResult = {
  rows: ExpenseRow[];
  skipped: number;
  /** Non-fatal problems the UI can surface to the user. */
  warnings: string[];
};

/** Column headers we recognize, mapped to internal field names. */
const HEADER_ALIASES: Record<string, keyof RawRow> = {
  date: "date",
  "transaction date": "date",
  "txn date": "date",
  num: "txnId",
  "trans #": "txnId",
  "transaction id": "txnId",
  name: "customer",
  customer: "customer",
  "customer:job": "customer",
  vendor: "vendor",
  account: "category",
  "split account": "category",
  category: "category",
  memo: "memo",
  "memo/description": "memo",
  description: "memo",
  amount: "amount",
  "amount (usd)": "amount",
  debit: "debit",
  credit: "credit",
};

type RawRow = {
  date?: string;
  txnId?: string;
  customer?: string;
  vendor?: string;
  category?: string;
  memo?: string;
  amount?: string;
  debit?: string;
  credit?: string;
};

export function parseQboCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = splitLines(text);

  const headerIdx = findHeaderRow(lines);
  if (headerIdx === -1) {
    return {
      rows: [],
      skipped: 0,
      warnings: ['Could not find a recognizable header row (need one of "Date", "Amount", "Account").'],
    };
  }

  const header = parseCsvRow(lines[headerIdx]);
  const columnMap = buildColumnMap(header);

  if (!columnMap.has("date") || !columnMap.has("amount")) {
    return {
      rows: [],
      skipped: 0,
      warnings: ['Header row is missing required columns ("Date" and "Amount").'],
    };
  }

  const rows: ExpenseRow[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = parseCsvRow(line);
    const raw: RawRow = {};
    for (const [field, col] of columnMap) {
      raw[field] = (cells[col] ?? "").trim();
    }

    // QBO sprinkles total rows ("Total for Smith Driveway", "TOTAL") into the
    // same report. Skip anything that doesn't look like a real line.
    if (isSubtotalRow(raw)) {
      skipped++;
      continue;
    }

    const parsed = toExpenseRow(raw, i + 1);
    if (!parsed) {
      skipped++;
      continue;
    }
    rows.push(parsed);
  }

  if (rows.length === 0) {
    warnings.push("No data rows parsed. Is this the right QuickBooks report?");
  }

  return { rows, skipped, warnings };
}

// ---------- helpers ----------

function splitLines(text: string): string[] {
  // Strip a UTF-8 BOM if present, then split on CRLF/LF.
  const clean = text.replace(/^\ufeff/, "");
  return clean.split(/\r\n|\n/);
}

function findHeaderRow(lines: string[]): number {
  // Scan the first 25 rows looking for one that contains Date + Amount (in
  // any order, any case). QBO reports put title/date range/blank rows before
  // the real header.
  const limit = Math.min(lines.length, 25);
  for (let i = 0; i < limit; i++) {
    const cells = parseCsvRow(lines[i]).map((c) => c.trim().toLowerCase());
    const hasDate = cells.some((c) => c === "date" || c === "transaction date" || c === "txn date");
    const hasAmount = cells.some((c) => c === "amount" || c === "debit" || c === "amount (usd)");
    if (hasDate && hasAmount) return i;
  }
  return -1;
}

function buildColumnMap(header: string[]): Map<keyof RawRow, number> {
  const map = new Map<keyof RawRow, number>();
  header.forEach((cell, idx) => {
    const key = cell.trim().toLowerCase();
    const field = HEADER_ALIASES[key];
    if (field && !map.has(field)) {
      map.set(field, idx);
    }
  });
  return map;
}

/**
 * Minimal CSV row parser. Handles quoted fields with embedded commas and
 * escaped quotes (""). Does NOT handle multi-line quoted fields — QBO
 * reports don't produce those and the complexity isn't worth it.
 */
export function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function isSubtotalRow(raw: RawRow): boolean {
  const memo = (raw.memo ?? "").toLowerCase();
  const customer = (raw.customer ?? raw.vendor ?? "").toLowerCase();
  if (!raw.date) return true;
  if (memo.startsWith("total for") || customer.startsWith("total for")) return true;
  if (memo === "total" || customer === "total") return true;
  return false;
}

function toExpenseRow(raw: RawRow, lineNumber: number): ExpenseRow | null {
  const date = parseDate(raw.date);
  if (!date) return null;

  const amount = parseAmount(raw);
  if (amount === null) return null;

  // Only ingest expenses (positive spend). Deposits/refunds/revenue land in
  // QBO on different accounts and shouldn't touch job profitability.
  if (amount <= 0) return null;

  return {
    qboTransactionId: raw.txnId?.trim() || `csv-${date}-${lineNumber}`,
    occurredOn: date,
    category: raw.category?.trim() || null,
    amount,
    memo: raw.memo?.trim() || null,
    rawCustomer: (raw.customer || raw.vendor || "").trim() || null,
    qboCustomerId: null,
  };
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  // QBO typically exports MM/DD/YYYY.
  const mdY = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdY) {
    const [, mm, dd, yy] = mdY;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // Fallback: ISO or anything Date() can handle.
  const d = new Date(value);
  if (!Number.isNaN(d.valueOf())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseAmount(raw: RawRow): number | null {
  // Prefer explicit debit; fall back to amount; then to credit*-1.
  const candidates = [raw.debit, raw.amount, raw.credit];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === "") continue;
    const num = toNumber(candidate);
    if (num !== null) return Math.abs(num);
  }
  return null;
}

function toNumber(value: string): number | null {
  // Strip $, commas, parentheses-as-negative.
  let v = value.trim().replace(/\$/g, "").replace(/,/g, "");
  let negative = false;
  if (v.startsWith("(") && v.endsWith(")")) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}
