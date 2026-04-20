/**
 * Resolve the public URL of the app, preferring signals in this order:
 *
 *   1. `NEXT_PUBLIC_APP_URL` env var — explicit production override.
 *      Set this on Vercel to something like `https://app.<domain>`.
 *
 *   2. Request headers — derive from `host` (or `x-forwarded-host`)
 *      + `x-forwarded-proto` when we're running in a route handler
 *      that has access to them. This is the fallback that saved the
 *      2026-04-19 magic-link bug: when NEXT_PUBLIC_APP_URL isn't set,
 *      Supabase's `emailRedirectTo` was defaulting to
 *      `http://localhost:3000/auth/callback`, which Supabase then
 *      rejected (not in the allowlist) and fell back to the Site URL
 *      (the marketing apex). Using the live request host avoids
 *      that trap entirely.
 *
 *   3. Vercel's `VERCEL_URL` — works on preview deployments where
 *      custom domains aren't set.
 *
 *   4. `http://localhost:3000` — dev fallback.
 *
 * Always call this from a server action / route handler that has
 * access to `headers()` — it'll pick the right origin without the
 * caller having to know anything about the host setup.
 */
import { headers } from "next/headers";

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

  // 3. Vercel preview deployments.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Local dev default.
  return "http://localhost:3000";
}
