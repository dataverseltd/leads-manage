// apps/web/src/components/push/PushManager.tsx
"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob !== "undefined" ? atob(base64) : "";
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushManager() {
  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator) || !("PushManager" in window))
          return;

        // 1) Register SW and wait until ready
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        await navigator.serviceWorker.ready;

        // 2) Permission
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        if (perm !== "granted") return;

        // 3) Get VAPID key
        const kRes = await fetch("/api/push/vapid-public", {
          cache: "no-store",
        });
        const { key } = await kRes.json();
        if (!key) return;

        const arr = urlBase64ToUint8Array(key);
        if (arr.byteLength !== 65) {
          console.warn("[push] Invalid VAPID key length:", arr.byteLength);
          return;
        }

        // 4) Get or reset subscription
        let sub = await reg.pushManager.getSubscription();
        if (sub) {
          const r = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
          if (!r.ok) {
            await sub.unsubscribe().catch(() => {});
            sub = null;
          }
        }

        // 5) Subscribe if needed
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: arr,
          });
        }

        // 6) Save subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch (e) {
        console.warn("[push] error", e);
      }
    })();
  }, []);

  return null; // headless
}
