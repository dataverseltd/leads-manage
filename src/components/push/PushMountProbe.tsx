// apps/web/src/components/push/PushMountProbe.tsx
"use client";

import { useEffect, useState } from "react";

export default function PushMountProbe() {
  const [status, setStatus] = useState("starting…");
  useEffect(() => {
    (async () => {
      try {
        setStatus("mounted ✓ — calling /api/push/vapid-public …");
        const r = await fetch("/api/push/vapid-public", { cache: "no-store" });
        const t = await r.text();
        setStatus(`API status ${r.status} — ${t.slice(0, 60)}…`);
      } catch (e: any) {
        setStatus(`fetch error: ${e?.message || String(e)}`);
      }
    })();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontFamily: "monospace",
        color: "#fff",
        background: "rgba(0,0,0,0.6)",
        zIndex: 999999,
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          padding: 16,
          border: "1px solid #fff",
          borderRadius: 8,
        }}
      >
        <div>PushMountProbe</div>
        <div style={{ marginTop: 6 }}>{status}</div>
      </div>
    </div>
  );
}
