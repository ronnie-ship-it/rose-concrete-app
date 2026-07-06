#!/usr/bin/env node
/**
 * Baseline the migrations_log for a database whose schema already exists
 * but whose log table is empty (e.g. log created fresh after a password
 * reset). Marks every migration file up to and including the given number
 * as applied WITHOUT running its SQL.
 *
 * Usage: node scripts/migrate-baseline.js 041
 */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

const upTo = process.argv[2];
if (!upTo || !/^\d+$/.test(upTo)) {
  console.error("Usage: node scripts/migrate-baseline.js <number, e.g. 041>");
  process.exit(1);
}
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[baseline] SUPABASE_DB_URL not set.");
  process.exit(1);
}

(async () => {
  const { Client } = require("pg");
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      create table if not exists public.migrations_log (
        filename   text primary key,
        sha256     text not null,
        applied_at timestamptz not null default now(),
        duration_ms int
      );
    `);
    const files = fs
      .readdirSync(path.join(ROOT, "migrations"))
      .filter((f) => f.endsWith(".sql") && f.slice(0, 3) <= upTo)
      .sort();
    for (const file of files) {
      const body = fs.readFileSync(path.join(ROOT, "migrations", file), "utf8");
      const hash = createHash("sha256").update(body).digest("hex");
      await client.query(
        `insert into public.migrations_log (filename, sha256, duration_ms)
         values ($1, $2, 0) on conflict (filename) do nothing`,
        [file, hash],
      );
      console.log(`  ✓ baselined ${file}`);
    }
    console.log(`[baseline] Done. ${files.length} files marked applied.`);
  } finally {
    await client.end().catch(() => undefined);
  }
})().catch((e) => {
  console.error("[baseline] failed:", e.message ?? e);
  process.exit(1);
});
