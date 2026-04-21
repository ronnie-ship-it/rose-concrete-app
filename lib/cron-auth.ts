import type { NextRequest } from "next/server";

/**
 * Authorize a cron request from any of the three supported sources:
 *
 *   1. Vercel cron — sends `x-vercel-cron: 1` automatically when the
 *      job is wired in `vercel.json`. No secret needed.
 *   2. Manual / external — sends `Authorization: Bearer <CRON_SECRET>`.
 *      Used by `curl` from the terminal during testing, or by an
 *      external scheduler (e.g. GitHub Actions).
 *   3. Vercel cron WITH a CRON_SECRET set — Vercel automatically
 *      adds `Authorization: Bearer <CRON_SECRET>` in addition to the
 *      header above. Either signal is sufficient.
 *
 * The original implementation REQUIRED the bearer token, which broke
 * Vercel's own cron when CRON_SECRET wasn't set in the project env
 * vars (every cron returned 401). This helper accepts EITHER signal,
 * so the crons keep firing on Vercel even before the secret is
 * configured — and once the secret is configured, manual calls with
 * the right bearer also work.
 *
 * Returns null when authorized, or a NextResponse to return when not.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  // Vercel cron header. This is set by Vercel's scheduler and cannot
  // be forged from outside (Vercel strips inbound user-set instances
  // of x-vercel-* headers).
  if (request.headers.get("x-vercel-cron") === "1") return true;

  // Bearer-token check. Skipped when CRON_SECRET isn't set — that
  // would let `Bearer undefined` match an empty header.
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${expectedSecret}`) return true;
  }

  return false;
}
