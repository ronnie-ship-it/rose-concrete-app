#!/usr/bin/env node
/**
 * Automatic Supabase migration runner.
 *
 * Reads every SQL file in `migrations/` in lexical order and runs
 * them against the Supabase project defined by the env vars in
 * `.env.local` — service-role key required because we're executing
 * DDL. Tracks which migrations have already been applied in a
 * `migrations_log` table so re-runs are idempotent.
 *
 * Usage:
 *   node scripts/migrate.js              # run pending migrations
 *   node scripts/migrate.js --status     # list status without applying
 *   node scripts/migrate.js --dry-run    # print would-run, no execute
 *   node scripts/migrate.js --force FILE # re-run one specific file
 *
 * Ronnie never has to paste SQL into the Supabase dashboard again —
 * `npm run migrate` does it all.
 *
 * Depends on: a Postgres connection. We use node's built-in `fetch`
 * to POST raw SQL to Supabase's `/rest/v1/rpc/exec_sql` endpoint
 * IF a helper function is available — otherwise we connect directly
 * via the `pg` driver (falls back to constructing a connection
 * string from `SUPABASE_DB_URL` or the `postgres://` in the
 * Supabase settings).
 *
 * Because the Supabase REST API doesn't natively support arbitrary
 * DDL, this script REQUIRES a direct Postgres connection. The
 * `SUPABASE_DB_URL` env var holds it (Supabase dashboard → Project
 * Settings → Database → Connection string → URI, with password
 * filled in).
 */
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "migrations");
const ENV_FILE = path.join(ROOT, ".env.local");

// ───── Parse .env.local ─────
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.warn(`[migrate] .env.local not found at ${ENV_FILE} — env vars must be set another way.`);
    return;
  }
  const content = fs.readFileSync(ENV_FILE, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

// ───── Connection string resolution ─────
function resolveDbUrl() {
  // Preferred: explicit SUPABASE_DB_URL (full postgres://… URI).
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  // Fallback: DATABASE_URL (generic naming convention).
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Can we build one from NEXT_PUBLIC_SUPABASE_URL + a password?
  // Supabase's pooler URL looks like:
  //   postgresql://postgres.<ref>:<password>@aws-0-us-west-1.pooler.supabase.com:6543/postgres
  // We can't derive the region automatically, so we bail with a
  // helpful message.
  console.error(
    "[migrate] No Supabase DB URL found. Set SUPABASE_DB_URL in .env.local.",
  );
  console.error(
    "          Get it from Supabase Dashboard → Project Settings → Database → Connection string.",
  );
  console.error("          Use the 'URI' format with the password filled in.");
  process.exit(1);
}

// ───── Args ─────
const args = process.argv.slice(2);
const flags = {
  status: args.includes("--status"),
  dryRun: args.includes("--dry-run"),
  force: args.includes("--force") ? args[args.indexOf("--force") + 1] : null,
};

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function main() {
  // Lazy-require pg so the stub-status path doesn't need it installed.
  let Client;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ Client } = require("pg"));
  } catch {
    console.error(
      "[migrate] The `pg` package is not installed. Run:  npm i -D pg",
    );
    process.exit(1);
  }

  const dbUrl = resolveDbUrl();
  const client = new Client({
    connectionString: dbUrl,
    // Supabase pooler requires TLS; rejectUnauthorized=false allows
    // the self-signed cert Supabase uses.
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // Bootstrap the migrations_log table. Idempotent.
    await client.query(`
      create table if not exists public.migrations_log (
        filename   text primary key,
        sha256     text not null,
        applied_at timestamptz not null default now(),
        duration_ms int
      );
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("[migrate] No .sql files in migrations/.");
      return;
    }

    const applied = new Map(
      (
        await client.query(
          "select filename, sha256 from public.migrations_log",
        )
      ).rows.map((r) => [r.filename, r.sha256]),
    );

    console.log(
      `[migrate] Found ${files.length} SQL files, ${applied.size} already applied.`,
    );

    let ran = 0;
    let skipped = 0;
    let failed = null;

    for (const file of files) {
      const filepath = path.join(MIGRATIONS_DIR, file);
      const body = fs.readFileSync(filepath, "utf8");
      const hash = sha256(body);
      const prior = applied.get(file);

      const shouldRun =
        flags.force === file || (!prior && !flags.status);

      if (flags.status) {
        const icon = prior ? "✓" : "·";
        const warn =
          prior && prior !== hash ? " (file changed since apply!)" : "";
        console.log(`  ${icon} ${file}${warn}`);
        continue;
      }

      if (!shouldRun) {
        const mismatch = prior && prior !== hash;
        if (mismatch) {
          console.log(
            `  ⚠ ${file} — already applied but file changed since (hash mismatch). Re-run with --force ${file} if intentional.`,
          );
        } else {
          skipped++;
        }
        continue;
      }

      if (flags.dryRun) {
        console.log(`  [dry-run] would apply ${file} (${body.length} bytes)`);
        continue;
      }

      console.log(`  → applying ${file}…`);
      const t0 = Date.now();
      try {
        // Each file runs in its own transaction. If it throws, the
        // whole file rolls back and we stop — don't want to leave
        // the schema in a partially-applied state.
        await client.query("begin");
        await client.query(body);
        await client.query(
          `insert into public.migrations_log (filename, sha256, duration_ms)
           values ($1, $2, $3)
           on conflict (filename) do update
             set sha256 = excluded.sha256,
                 applied_at = now(),
                 duration_ms = excluded.duration_ms`,
          [file, hash, Date.now() - t0],
        );
        await client.query("commit");
        console.log(`    ✓ applied in ${Date.now() - t0}ms`);
        ran++;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        failed = { file, error: err };
        console.error(`    ✗ FAILED: ${err.message ?? err}`);
        break;
      }
    }

    if (failed) {
      console.error(
        `\n[migrate] Stopped at ${failed.file}. Fix the error and re-run.`,
      );
      process.exit(1);
    }

    if (flags.status) return;
    console.log(
      `\n[migrate] Done. Applied ${ran}, skipped ${skipped} already-applied.`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[migrate] unexpected failure:", err);
  process.exit(1);
});
