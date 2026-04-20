/**
 * Minimal RFC 4180-ish CSV parser. Handles quoted fields with commas,
 * escaped quotes (""), and CRLF or LF line endings. Returns an array of
 * objects keyed by the (normalized) header row.
 *
 * Header normalization: lowercased, non-alphanumeric collapsed to `_`,
 * stripped at edges — so "Billing Address Street 1" becomes
 * "billing_address_street_1". Lookups should use the same normalizer.
 */

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Strip trailing blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = splitCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (cells[i] ?? "").trim();
    }
    return obj;
  });
}

/** Look up the first non-empty value among a list of candidate keys. */
export function pick(
  row: Record<string, string>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}
