/**
 * Jobber → Rose Concrete migration script.
 *
 * Run AFTER the Jobber MCP credentials are reconnected and you've exported
 * clients/jobs/quotes/visits to scripts/jobber-export/*.json via the
 * jobber-connector skills (manage-clients, manage-jobs, scheduling).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-jobber.ts
 *
 * This is intentionally a scaffold — real field mapping happens after we see
 * the shape of the Jobber export JSON.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const EXPORT_DIR = join(process.cwd(), "scripts", "jobber-export");

async function loadJson<T>(name: string): Promise<T[]> {
  try {
    const raw = await readFile(join(EXPORT_DIR, name), "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    console.warn(`  (no ${name} found — skipping)`);
    return [];
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log("Loading Jobber exports from", EXPORT_DIR);
  const clients = await loadJson<any>("clients.json");
  const jobs = await loadJson<any>("jobs.json");
  const quotes = await loadJson<any>("quotes.json");
  const visits = await loadJson<any>("visits.json");

  console.log(`  ${clients.length} clients, ${jobs.length} jobs, ${quotes.length} quotes, ${visits.length} visits`);

  if (clients.length === 0) {
    console.log("Nothing to import. Run the Jobber export first.");
    return;
  }

  // TODO: map and insert. Field mapping finalized once we see a sample of the
  // real export. Keep this file minimal until then so nothing runs accidentally.
  console.log("Field mapping not yet implemented — paste sample JSON in a PR before wiring.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
