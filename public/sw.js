// Rose Concrete service worker.
//
// Today this only handles push events — we register it explicitly from
// components/push-enroll.tsx. We do NOT take over fetch() for caching yet;
// a full offline shell is a separate workstream.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Fallback — server sent a plain text payload.
    data = { title: "Rose Concrete", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Rose Concrete";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag, // same-tag pushes replace in-place instead of stacking
    requireInteraction: data.requireInteraction === true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      // If a tab is already on our origin, focus it + navigate.
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
      // Otherwise open a new window.
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
