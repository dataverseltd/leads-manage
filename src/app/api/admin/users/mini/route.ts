// apps/web/src/app/api/admin/users/mini/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SERVER_API } from "@/lib/server-api";

type CustomSession = Session & {
  sessionToken?: string | null;
  user?: Session["user"] & {
    sessionToken?: string | null;
    role?: string | null;
  };
  role?: string | null;
};

function getSessionToken(session: CustomSession | null): string {
  if (!session) return "";
  return (session.sessionToken ?? session.user?.sessionToken ?? "") || "";
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyText = await req.text();
  const upstream = await fetch(`${SERVER_API}/api/admin/users/mini`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": getSessionToken(session),
      "x-role": (session.role ?? session.user?.role ?? "") || "",
    },
    body: bodyText,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
