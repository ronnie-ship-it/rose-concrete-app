/**
 * One-shot codemod: replace every CRON_SECRET auth block in
 * `app/api/cron/*\/route.ts` with a single call to
 * `isAuthorizedCronRequest()`. Idempotent: skips files already
 * using the helper.
 *
 * The auth blocks have ~5 different shapes across the existing
 * cron files (single-line, multi-line, with/without authHeader
 * temp var, with/without x-vercel-cron fallback). We use a single
 * permissive regex that matches any `if (...) { return 401; }` block
 * containing `CRON_SECRET` plus the 401 return inside.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "app/api/cron";
const HELPER_IMPORT = `import { isAuthorizedCronRequest } from "@/lib/cron-auth";`;

// Match the entire auth block in three steps:
//   1. Optional `const authHeader = request.headers.get("authorization");`
//   2. The `if (...) {` whose condition mentions CRON_SECRET
//   3. The 401 return + closing brace
//
// `[\s\S]*?` is the lazy any-char-including-newline operator.
const AUTH_BLOCK = new RegExp(
  String.raw`(?:\s*const authHeader = request\.headers\.get\("authorization"\);\s*\n)?` +
    String.raw`\s*if \(\s*[\s\S]*?CRON_SECRET[\s\S]*?\) \{\s*\n` +
    String.raw`\s*return NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\);\s*\n` +
    String.raw`\s*\}`,
  "m",
);

const REPLACEMENT = `if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }`;

let touched = 0;
let skipped = 0;
let unmatched = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (entry === "route.ts") {
      patch(full);
    }
  }
}

function patch(file) {
  let src = readFileSync(file, "utf8");
  if (src.includes("isAuthorizedCronRequest")) {
    skipped++;
    return;
  }
  if (!AUTH_BLOCK.test(src)) {
    unmatched.push(file);
    return;
  }
  src = src.replace(AUTH_BLOCK, "  " + REPLACEMENT);
  if (!src.includes(HELPER_IMPORT)) {
    src = src.replace(
      /(import \{ NextResponse[^\n]*\n)/,
      `$1${HELPER_IMPORT}\n`,
    );
  }
  writeFileSync(file, src);
  console.log(`  ✓ patched ${file}`);
  touched++;
}

walk(ROOT);
console.log(`\nDone — patched ${touched}, skipped (already done) ${skipped}.`);
if (unmatched.length) {
  console.log(`\nUnmatched (need manual fix):`);
  unmatched.forEach((f) => console.log("  -", f));
}
