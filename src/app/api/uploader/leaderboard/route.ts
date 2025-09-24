// apps/web/src/app/api/uploader/leaderboard/route.ts
import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

type AppSession = Session & { sessionToken?: string };

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.sessionToken;
  const url = new URL(req.url);

  const range = url.searchParams.get("range") || "month";
  const month = url.searchParams.get("month") || "";
  const companyId = url.searchParams.get("companyId") || "";

  const headers: Record<string, string> = {};
  if (token) headers["x-session-token"] = token;

  const qs = new URLSearchParams();
  if (range) qs.set("range", range);
  if (month) qs.set("month", month);
  if (companyId) qs.set("companyId", companyId);

  const resp = await fetch(`${SERVER_API}/api/uploader/leaderboard?${qs.toString()}`, {
    headers,
    // credentials not needed here because we forward the session token explicitly
  });

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
