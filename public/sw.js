// apps/web/public/sw.js

/* =========================
   Web Push Service Worker
   ========================= */
const SW_VERSION = 'v1.0.0';

/** Optional default assets (replace with your own) */
const ICON = '/logo.png';
const BADGE = '/favicon.ico';

/** Safe JSON parse */
function toJSON(data) {
  try { return data ? data.json() : {}; } catch { return {}; }
}

/** Normalize a URL to same-origin absolute URL */
function toAppUrl(input, fallback = '/') {
  try {
    const u = new URL(input, self.location.origin);
    return u.href;
  } catch {
    return new URL(fallback, self.location.origin).href;
  }
}

/** Focus an existing window if it matches, else open a new one */
async function focusOrOpen(url) {
  const target = toAppUrl(url, '/');
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of allClients) {
    if (!client.url) continue;
    // Loose match: same origin + path starts with target path
    if (client.url === target || client.url.startsWith(target)) {
      if ('focus' in client) return client.focus();
    }
  }
  if (self.clients.openWindow) return self.clients.openWindow(target);
}

/* ---------- Lifecycle ---------- */
self.addEventListener('install', (event) => {
  // Activate new SW immediately (skip old waiting)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Control already open pages
  event.waitUntil(self.clients.claim());
});

/* ---------- Push handler ---------- */
self.addEventListener('push', (event) => {
  const payload = toJSON(event.data) || {};

  const title = payload.title || 'Notification';
  const body  = payload.body  || '';
  const data  = payload.data  || {};
  const tag   = data.tag || payload.tag || (payload.type || 'general');

  /** Options per MDN */
  const options = {
    body,
    tag,                 // dedupe/stack by tag
    renotify: true,      // re-alert on same tag
    data: {
      // carry-through data for click handler
      url: data.url || '/dashboard/signup-summary',
      ...data,
      _meta: { sw: SW_VERSION, ts: Date.now() },
    },
    icon: ICON,          // replace with your assets
    badge: BADGE,
    timestamp: Date.now(),
    requireInteraction: Boolean(payload.requireInteraction), // keep visible until user interacts
    silent: Boolean(payload.silent || false),                // not widely honored
    // actions: [{ action: 'open', title: 'Open' }],          // optional
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- Click handler ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action || 'default';
  const data = event.notification?.data || {};
  const url = data.url || '/';

  // Route by action if you add actions later
  // if (action === 'mark_read') { ... }

  event.waitUntil(focusOrOpen(url));
});

/* ---------- Close handler (optional analytics hook) ---------- */
self.addEventListener('notificationclose', (event) => {
  // You can postMessage to clients or beacon to your API here if needed
  // const data = event.notification?.data;
});

/* ---------- Subscription change (rare; Chromium may fire on key rotation) ---------- */
self.addEventListener('pushsubscriptionchange', (event) => {
  // Strategy: let the page resubscribe on next load, or
  // attempt a blind resubscribe here if your server exposes an endpoint.
  // Keeping it minimal/neutral:
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      client.postMessage({ type: 'pushsubscriptionchange', payload: { reason: 'expired' } });
    }
  })());
});

/* ---------- Soft update from app (optional) ---------- */
// In app, you can: navigator.serviceWorker.controller?.postMessage({type:'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
