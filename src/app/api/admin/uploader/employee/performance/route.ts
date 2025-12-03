// apps/web/src/app/api/admin/uploader/employee/performance/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

type AppSession = Session & { sessionToken?: string };

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = session.sessionToken;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || "";

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams();
  qs.set("companyId", companyId);

  const headers: Record<string, string> = {};
  if (token) headers["x-session-token"] = token;

  const resp = await fetch(
    `${SERVER_API}/api/uploader/employee/performance?${qs.toString()}`,
    {
      headers,
    }
  );

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
