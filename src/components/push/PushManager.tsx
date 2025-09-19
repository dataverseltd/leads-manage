// apps/web/src/components/push/PushManager.tsx
"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushManager() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      try {
        // 1) Register SW
        const reg = await navigator.serviceWorker.register("/sw.js");
        // 2) Ask permission (idempotent)
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        if (perm !== "granted") {
          console.warn("[push] Permission not granted");
          setReady(false);
          return;
        }

        // 3) Get VAPID public key
        const kRes = await fetch("/api/push/vapid-public", {
          cache: "no-store",
        });
        const { key } = await kRes.json();
        if (!key) {
          console.warn("[push] Missing VAPID public key");
          return;
        }

        // 4) Subscribe (or reuse existing)
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }

        // 5) Save to server (proxied)
        const r = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        if (!r.ok) throw new Error(await r.text());
        setReady(true);
        // toast.success("Push enabled"); // optional
      } catch (e) {
        console.warn("[push] error", e);
        setReady(false);
      }
    })();

    // (Optional) cleanup on sign-out is handled elsewhere
  }, []);

  return null; // headless
}
