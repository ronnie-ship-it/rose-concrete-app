#!/usr/bin/env node
/**
 * Ship script — commits every uncommitted change with a descriptive
 * message and pushes to origin/main. Runs at the end of each build
 * session so Vercel redeploys without Ronnie having to touch PowerShell.
 *
 * Usage:
 *   node scripts/ship.mjs                   # commit all + push
 *   node scripts/ship.mjs --message "..."   # override commit message
 *   node scripts/ship.mjs --dry-run         # show what would happen
 *   node scripts/ship.mjs --no-push         # commit locally, don't push
 *
 * Commit message is assembled from the list of files changed + a
 * short summary. Safe to re-run — if there's nothing to commit we
 * just try the push (in case a prior commit didn't make it up).
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes("--dry-run"),
  noPush: args.includes("--no-push"),
  // --skip-typecheck keeps the option to push fast when the typecheck
  // is broken on a known-but-tolerable issue. Default is to typecheck.
  skipTypecheck: args.includes("--skip-typecheck"),
  message:
    args.includes("--message") || args.includes("-m")
      ? args[Math.max(args.indexOf("--message"), args.indexOf("-m")) + 1]
      : null,
};

function run(cmd, opts = {}) {
  if (flags.dryRun && !opts.alwaysRun) {
    console.log(`  [dry-run] ${cmd}`);
    return "";
  }
  return execSync(cmd, { cwd: root, stdio: opts.pipe ? "pipe" : "inherit", encoding: "utf8" });
}

function runPipe(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

// Sanity: must be inside a git repo.
try {
  runPipe("git rev-parse --git-dir");
} catch {
  console.error("[ship] Not a git repo. Run `git init` first.");
  process.exit(1);
}

// Typecheck before we ship — a green tsc gate is far cheaper than a
// broken Vercel deploy. Skippable with --skip-typecheck if the user
// knows the build is broken but still wants to push.
//
// We invoke the TS compiler via `node` directly (not `./node_modules/.bin/tsc`)
// so this works the same on Windows + macOS + Linux without relying on
// the shell finding the bin shim.
if (!flags.skipTypecheck && !flags.dryRun) {
  console.log("[ship] Running typecheck (tsc --noEmit)…");
  const tscPath = join(root, "node_modules", "typescript", "bin", "tsc");
  try {
    execSync(`node "${tscPath}" --noEmit`, {
      cwd: root,
      stdio: "inherit",
    });
    console.log("[ship] ✓ typecheck clean");
  } catch {
    console.error("\n[ship] ✗ typecheck FAILED.");
    console.error(
      "[ship] Fix the errors above, or pass --skip-typecheck if you really want to push.",
    );
    process.exit(1);
  }
}

// Anything staged / unstaged / untracked?
const status = runPipe("git status --porcelain");
if (!status) {
  console.log("[ship] Nothing to commit.");
  if (!flags.noPush) {
    console.log("[ship] Running `git push` anyway in case a prior commit didn't make it up…");
    try {
      run("git push");
    } catch {
      // Swallow — user will see the error from git directly.
    }
  }
  process.exit(0);
}

// Build a sensible commit message from the change set.
const lines = status.split("\n").filter(Boolean);
const added = lines.filter((l) => l.startsWith("??")).length;
const modified = lines.filter((l) => l.trim().startsWith("M")).length;
const deleted = lines.filter((l) => l.trim().startsWith("D")).length;

// Pick the most-changed top-level dir for the summary — gives a hint
// about the session's focus without us having to pass context.
const byDir = new Map();
for (const line of lines) {
  const p = line.slice(3).trim().split(/[\\/]/);
  const top = p[0];
  byDir.set(top, (byDir.get(top) ?? 0) + 1);
}
const focusDir = [...byDir.entries()]
  .sort((a, b) => b[1] - a[1])[0]?.[0];

const summary =
  flags.message ??
  `session: ${[
    added ? `${added} new` : null,
    modified ? `${modified} changed` : null,
    deleted ? `${deleted} deleted` : null,
  ]
    .filter(Boolean)
    .join(", ")}${focusDir ? ` (mostly in ${focusDir}/)` : ""}`;

const today = new Date().toISOString().slice(0, 10);
const commitMessage = `${summary}

Session date: ${today}
Files changed: ${lines.length}

🤖 Auto-committed by scripts/ship.mjs
`;

console.log("[ship] Staging:");
for (const line of lines.slice(0, 30)) console.log(`  ${line}`);
if (lines.length > 30) console.log(`  …and ${lines.length - 30} more`);

run("git add -A");

// Escape the message for the shell. Easiest: write to temp file.
// But here it's fine — execSync double-quotes + JS template literal
// with newlines works on Bash + PowerShell when using the -F flag.
// We use the --file approach to avoid shell escaping entirely.
import("node:fs").then((fs) => {
  const msgFile = join(root, ".git", "COMMIT_EDITMSG_ship");
  fs.writeFileSync(msgFile, commitMessage);
  try {
    if (flags.dryRun) {
      console.log("\n[ship] [dry-run] would commit:");
      console.log(commitMessage);
    } else {
      run(`git commit -F "${msgFile}"`);
    }
    if (!flags.noPush) {
      console.log("\n[ship] Pushing to origin…");
      run("git push");
      console.log("[ship] ✓ pushed");
    } else {
      console.log("[ship] Skipping push (--no-push).");
    }
  } finally {
    try {
      fs.unlinkSync(msgFile);
    } catch {
      // ignore
    }
  }
});
