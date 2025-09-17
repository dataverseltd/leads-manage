// apps/web/src/app/api/ably/token/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
// 👇 use the promise build
import Ably from "ably";

export async function GET(req: NextRequest) {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    console.error("[ably token] Missing ABLY_API_KEY in apps/web/.env.local");
    return NextResponse.json({ error: "ABLY not configured" }, { status: 500 });
  }

  const rest = new Ably.Rest({ key });

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") || "anon";

    // promise API, no callback typing drama
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: companyId,
    });

    return NextResponse.json(tokenRequest, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[ably token] error:", err);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
