// apps/web/public/sw.js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Basic push handler
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = payload.title || "New Notification";
  const body = payload.body || "";
  const data = payload.data || {};
  const tag = data.tag || "signup-summary";

  const options = {
    body,
    tag,
    renotify: true,
    data,
    // add icons if you have them:
    // icon: "/icons/icon-192.png",
    // badge: "/icons/badge-72.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus or open signup summary on click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/dashboard/signup-summary";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      // focus if already open
      for (const client of clientsArr) {
        if ("focus" in client && client.url.includes(url)) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
