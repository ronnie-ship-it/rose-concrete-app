/**
 * Resolve the public URL of the app, preferring signals in this order:
 *
 *   1. `NEXT_PUBLIC_APP_URL` env var — explicit production override.
 *      Set this on Vercel to `https://app.<domain>` once DNS is live.
 *
 *   2. Request headers — derive from `host` (or `x-forwarded-host`)
 *      + `x-forwarded-proto`. This is the fallback that fixes the
 *      magic-link bug: when NEXT_PUBLIC_APP_URL isn't set, Supabase's
 *      `emailRedirectTo` was defaulting to `http://localhost:3000/...`
 *      which Supabase rejected (not in the allowlist) and fell back
 *      to Site URL (the marketing apex). Using the live request host
 *      side-steps that trap.
 *
 *   3. Vercel's `VERCEL_URL` — works on preview deployments where
 *      custom domains aren't set.
 *
 *   4. `VERCEL_FALLBACK_URL` (or our hardcoded preview URL) — final
 *      safety net so prod-like Vercel deploys never fall back to
 *      localhost and trigger the magic-link loop again.
 *
 *   5. `http://localhost:3000` — dev fallback.
 *
 * Always call this from a server action / route handler that has
 * access to `headers()` — it'll pick the right origin without the
 * caller having to know anything about the host setup.
 */
import { headers } from "next/headers";

/**
 * Hardcoded fallback URL so Vercel deploys that don't set
 * NEXT_PUBLIC_APP_URL or VERCEL_URL still route correctly. Update
 * this constant when the Vercel project moves to a new preview URL.
 */
const HARDCODED_VERCEL_URL = "https://rose-concrete-app-v2.vercel.app";

export async function resolveAppUrl(): Promise<string> {
  // 1. Explicit env var wins.
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 2. Live request headers.
  try {
    const h = await headers();
    const forwardedHost = h.get("x-forwarded-host");
    const host = forwardedHost ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? "https";
      // Prefer the app subdomain if we happen to be running on the
      // marketing apex — magic links need to scope their cookie to
      // app.* or the dashboard won't see the session.
      const bare = host.toLowerCase().replace(/^www\./, "");
      const appHost =
        bare.startsWith("app.") ||
        bare.includes("localhost") ||
        bare.endsWith(".vercel.app") ||
        bare.startsWith("127.0.0.1")
          ? bare
          : `app.${bare}`;
      return `${proto}://${appHost}`;
    }
  } catch {
    // headers() can throw when called outside a request scope — fall
    // through to the next signal.
  }

  // 3. Vercel preview / production deployments.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Running on Vercel (VERCEL=1) but no URL detected — use the
  //    hardcoded fallback rather than localhost so production magic
  //    links don't silently 404.
  if (process.env.VERCEL) {
    return HARDCODED_VERCEL_URL;
  }

  // 5. Local dev default.
  return "http://localhost:3000";
}
