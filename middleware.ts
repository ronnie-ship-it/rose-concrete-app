import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Host-based routing.
 *
 *   sandiegoconcrete.ai (+ www)  →  marketing site (apex).
 *   app.sandiegoconcrete.ai      →  dashboard + crew PWA.
 *   localhost / *.vercel.app     →  everything (dev convenience).
 *
 * THE FIRST THING THIS FILE DOES, before anything else, is catch any
 * request carrying ?code= or ?token_hash= and forward it to
 * /auth/callback. Supabase's magic link can land on any host
 * depending on Site URL config, and the auth callback route is the
 * only place that knows how to exchange the code for a session.
 * This catch-all is the most important line of code in this file —
 * if it doesn't fire, magic-link sign-in silently fails.
 */

const APP_HOST_PREFIX = "app.";

const PUBLIC_PATH_PREFIXES = [
  "/services/",
  "/landing/",
  "/service-areas/",
  "/about-us",
  "/contact",
  "/book",
  "/q/",
  "/pay/",
  "/change-order/",
  "/hub/",
  "/embed/",
  "/forms/",
  "/api/leads",
  "/api/public/",
  "/api/webhooks/",
  "/api/health",
  "/auth/",
  "/_next/",
  "/favicon",
  "/robots",
  "/sitemap",
  "/manifest",
  "/icon-",
];

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/about-us",
  "/contact",
  "/services",
  "/service-areas",
  "/landing",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function stripWww(host: string): string {
  return host.replace(/^www\./, "");
}

function isAppHost(host: string): boolean {
  return host.toLowerCase().startsWith(APP_HOST_PREFIX);
}

function isMarketingHost(host: string): boolean {
  const h = stripWww(host).toLowerCase();
  if (h.startsWith(APP_HOST_PREFIX)) return false;
  if (h.includes("localhost")) return false;
  if (h.endsWith(".vercel.app")) return false;
  if (h.startsWith("127.0.0.1") || h.startsWith("0.0.0.0")) return false;
  return true;
}

function appHostFromMarketing(host: string): string {
  const bare = stripWww(host);
  return `${APP_HOST_PREFIX}${bare}`;
}

/**
 * Detect a Supabase magic-link callback by looking for `?code=` or
 * `?token_hash=` in the URL. We check via TWO independent methods so a
 * weird URL parser somewhere can't silently drop the catch:
 *
 *   1. `nextUrl.searchParams` — the standard Web API.
 *   2. Regex against the raw request.url string — fallback if (1)
 *      returns false negative.
 *
 * Returns true if the URL looks like a Supabase callback.
 */
function looksLikeAuthCallback(request: NextRequest): boolean {
  const sp = request.nextUrl.searchParams;
  if (sp.has("code") || sp.has("token_hash")) return true;
  // Belt-and-suspenders: scan the raw URL too.
  const url = request.url;
  if (/[?&](code|token_hash)=/.test(url)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ════════════════════════════════════════════════════════════════
  // PRIORITY 0 — magic-link catch-all. Runs BEFORE anything else.
  // If we don't catch ?code= here, the user lands on whatever page
  // the URL points at (usually the marketing apex) and the code is
  // never exchanged.
  //
  // We also force the redirect to land on the same origin to avoid
  // any host-based redirect chain that could drop the query string.
  // The /auth/callback route handler is the one that decides whether
  // to forward to a different subdomain.
  // ════════════════════════════════════════════════════════════════
  if (looksLikeAuthCallback(request) && pathname !== "/auth/callback") {
    // Build the target URL from scratch to make absolutely sure the
    // query string is preserved. Cloning nextUrl is the documented
    // approach but we've seen it lose params in edge cases.
    const target = new URL(request.url);
    target.pathname = "/auth/callback";
    // Vercel logs this so we can confirm the catch fired.
    console.log(
      `[middleware] auth catch-all: ${pathname}${request.nextUrl.search} → /auth/callback`,
    );
    // 307 (temporary, preserves method) is the right semantic — magic
    // links are GETs but a future flow might POST through this path.
    return NextResponse.redirect(target, { status: 307 });
  }

  // ════════════════════════════════════════════════════════════════
  // From here down, normal host-based routing.
  // ════════════════════════════════════════════════════════════════
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { search } = request.nextUrl;

  // Refresh Supabase auth cookies on every request — needed for the
  // dashboard surface, harmless on the marketing surface.
  const sessionResponse = await updateSession(request);

  // App subdomain: bare `/` is the auth gate.
  if (isAppHost(host)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return sessionResponse;
  }

  if (!isMarketingHost(host)) {
    // localhost, vercel.app previews, raw IPs — everything's accessible.
    return sessionResponse;
  }

  // Marketing host. Public paths render directly; everything else
  // bounces to the app.* subdomain.
  if (isPublicPath(pathname)) {
    return sessionResponse;
  }

  const protocol = request.nextUrl.protocol || "https:";
  const target = `${protocol}//${appHostFromMarketing(host)}${pathname}${search}`;
  return NextResponse.redirect(target);
}

export const config = {
  // Run on EVERYTHING except Next internals + image extensions. The
  // wide net is intentional — the auth catch-all needs to fire on
  // any path, including `/`, that might receive a magic-link code.
  //
  // The path `/` matches because the negative lookahead doesn't
  // reject empty strings.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
