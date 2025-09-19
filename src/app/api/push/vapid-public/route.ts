// apps/web/src/app/api/push/vapid-public/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { SERVER_API } from "@/lib/server-api";

export async function GET() {
  const r = await fetch(`${SERVER_API}/api/push/vapid-public`, {
    cache: "no-store",
  });
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "application/json",
    },
  });
}
