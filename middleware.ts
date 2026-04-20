import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Host-based routing.
 *
 * One Vercel project, two customer-facing surfaces:
 *
 *   sandiegoconcrete.ai (+ www)  →  marketing site (apex). Renders the
 *                                   pages in app/(marketing)/* plus the
 *                                   existing public flows (/book, /q,
 *                                   /pay, /change-order, /hub, /embed,
 *                                   /api/public, /api/webhooks, /api/leads).
 *   app.sandiegoconcrete.ai      →  dashboard + crew PWA (requires login).
 *                                   `/` redirects to `/login` which fans
 *                                   out to the role-appropriate landing
 *                                   path once authenticated.
 *   localhost / *.vercel.app     →  everything (dev convenience). The
 *                                   marketing home renders at `/`; the
 *                                   business app is reachable at /login,
 *                                   /dashboard, /crew, etc.
 *
 * This middleware:
 *   1. Keeps the Supabase session cookies fresh on every request.
 *   2. On the app.* host, redirects bare `/` → `/login` so office staff
 *      never land on the marketing home as their default.
 *   3. On the marketing host, allows the public path allowlist through
 *      and bounces everything else (e.g. /dashboard, /crew, /login) to
 *      the app.* subdomain so the office app can't leak onto the public
 *      domain.
 *
 * `PUBLIC_PATH_PREFIXES` is the allowlist of paths that resolve on the
 * marketing host. Anything not in the list gets a 302 to app.<root>.
 */

const APP_HOST_PREFIX = "app.";

const PUBLIC_PATH_PREFIXES = [
  // Marketing site routes (app/(marketing)/*).
  "/services/",
  "/landing/",
  "/service-areas/",
  "/about-us",
  "/contact",
  // Existing customer-facing flows kept on the marketing domain.
  "/book",
  "/q/",
  "/pay/",
  "/change-order/",
  "/hub/",
  "/embed/",
  "/forms/",          // customer signature/ack forms (round 12)
  // Public API surfaces.
  "/api/leads",       // same-origin marketing form post
  "/api/public/",     // cross-origin webhooks (x-rose-secret guarded)
  "/api/webhooks/",   // third-party callbacks (poptin, etc.)
  "/api/health",      // uptime monitor
  // /signup + /login intentionally NOT here — they live on the app
  // subdomain so the session cookie scopes to app.* only, avoiding
  // cookie-domain confusion across marketing and app surfaces.
  // Static / framework.
  "/_next/",
  "/favicon",
  "/robots",
  "/sitemap",
  "/manifest",
  "/icon-",
];

// Bare paths (no trailing slash) that need an exact match because the
// prefix entries below all include trailing slashes — e.g. `/services`
// would not match the `/services/` prefix.
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
  // True for `sandiegoconcrete.ai` and any future custom marketing domain
  // that doesn't start with `app.`. Localhost + vercel.app previews are
  // excluded so dev + PR previews continue to expose the whole app from
  // the same host.
  if (h.startsWith(APP_HOST_PREFIX)) return false;
  if (h.includes("localhost")) return false;
  if (h.endsWith(".vercel.app")) return false;
  if (h.startsWith("127.0.0.1") || h.startsWith("0.0.0.0")) return false;
  return true;
}

function appHostFromMarketing(host: string): string {
  // `sandiegoconcrete.ai`     → `app.sandiegoconcrete.ai`
  // `www.sandiegoconcrete.ai` → `app.sandiegoconcrete.ai`
  const bare = stripWww(host);
  return `${APP_HOST_PREFIX}${bare}`;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname, search } = request.nextUrl;

  // Refresh Supabase auth cookies on every request — needed for the
  // dashboard surface, harmless on the marketing surface.
  const sessionResponse = await updateSession(request);

  // App subdomain: bare `/` is the auth gate. /login redirects to the
  // role-appropriate landing path when the session is already valid, so
  // we don't need to duplicate that logic here.
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

  // Marketing host. Public paths render directly from app/(marketing)
  // and the existing public flow folders. Anything else belongs on app.*.
  if (isPublicPath(pathname)) {
    return sessionResponse;
  }

  const protocol = request.nextUrl.protocol || "https:";
  const target = `${protocol}//${appHostFromMarketing(host)}${pathname}${search}`;
  return NextResponse.redirect(target);
}

export const config = {
  // Run on everything except static assets and Next.js internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
