// Rose Concrete service worker.
//
// Two jobs:
//   1. Handle push events (existing — registered from components/push-enroll.tsx).
//   2. Offline cache for the crew PWA. When a crew member loses signal,
//      /crew (and the most recent "Today" page) stays readable.
//
// Strategy:
//   - Precache the shell (/crew, /crew/schedule, /crew/upload, /crew/form)
//     on install so the navigation skeleton always loads.
//   - Runtime cache /crew navigations with a stale-while-revalidate
//     strategy: serve cache first for speed, refresh in the background.
//   - Runtime cache images + static Next.js chunks with cache-first so
//     photos the crew uploaded aren't re-fetched every view.
//   - Everything else falls through to the network (dashboard pages,
//     server actions, API routes all require fresh data).

// Bump this whenever crew UI ships a structural change you want to land
// immediately. The activate handler nukes any cache whose key doesn't end
// in the current version, forcing fresh fetches on the next navigation.
const CACHE_VERSION = "v4-2026-04-24-jobber-rebuild";
const SHELL_CACHE = `rose-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rose-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `rose-images-${CACHE_VERSION}`;

// Paths we precache on install so the crew app boots offline.
const SHELL_URLS = [
  "/crew",
  "/crew/schedule",
  "/crew/upload",
  "/crew/form",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort — if a URL 404s or errors we still install the worker.
      Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[sw] precache skip", url, err && err.message),
          ),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              !k.endsWith(CACHE_VERSION) &&
              (k.startsWith("rose-shell-") ||
                k.startsWith("rose-runtime-") ||
                k.startsWith("rose-images-")),
          )
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Only intercept GET requests — POST/server-action traffic goes straight
// to the network so writes never stall offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase auth endpoints or server actions.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Crew navigations — NETWORK-FIRST so deploys show up immediately.
  // Falls back to cache only when offline. (Was stale-while-revalidate,
  // which made every deploy take two reloads to land.)
  if (url.pathname === "/crew" || url.pathname.startsWith("/crew/")) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // Cache-first for images (small photos + icons).
  if (
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpe?g|webp|svg|gif|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Cache-first for Next.js static chunks.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      // Don't cache errors or opaque redirects.
      if (response.ok && response.type === "basic") {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    if (cached) return cached;
    throw new Error("offline");
  }
}

// ----- push notifications -----

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Rose Concrete", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Rose Concrete";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag,
    requireInteraction: data.requireInteraction === true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of clientsList) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) c.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
