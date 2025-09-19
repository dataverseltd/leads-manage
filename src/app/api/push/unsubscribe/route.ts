// apps/web/src/app/api/push/unsubscribe/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SERVER_API } from "@/lib/server-api";

/* ---------- Types ---------- */
type SessionUserExtras = {
  sessionToken?: string | null;
};

type CustomSession = Session & {
  sessionToken?: string | null; // sometimes stored at root
  user?: Session["user"] & SessionUserExtras;
};

/* ---------- Helpers ---------- */
function getSessionToken(session: CustomSession | null): string {
  if (!session) return "";
  const root = session.sessionToken ?? null;
  const nested = session.user?.sessionToken ?? null;
  return (root ?? nested ?? "") as string;
}

/* ---------- Route ---------- */
export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();

  const r = await fetch(`${SERVER_API}/api/push/unsubscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": getSessionToken(session),
    },
    body,
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "application/json",
    },
  });
}
