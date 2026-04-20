import { NextResponse } from "next/server";

/**
 * Minimal health endpoint for uptime monitors. Returns
 * { ok: true } with the git SHA + node env so Vercel health
 * checks / uptimerobot / etc. have something to diff on deploy.
 *
 * Deliberately NOT protected — it has no secret information.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    env: process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    deployed_at: process.env.VERCEL_GIT_COMMIT_REF
      ? new Date().toISOString()
      : null,
  });
}
