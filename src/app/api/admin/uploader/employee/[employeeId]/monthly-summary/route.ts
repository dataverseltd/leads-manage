// apps/web/src/app/api/admin/uploader/employee/[employeeId]/monthly-summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

type AppSession = Session & { sessionToken?: string };

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    // ✔ next.js requires awaiting params
    const { employeeId } = await context.params;

    // 1) Auth check
    const session = (await getServerSession(authOptions)) as AppSession | null;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = session.sessionToken;

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 }
      );
    }

    // 2) Extract query
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") || "";
    const months = url.searchParams.get("months") || "";

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    // Build QS
    const qs = new URLSearchParams();
    qs.set("companyId", companyId);
    if (months) qs.set("months", months);

    // 3) Forward to server
    const headers: Record<string, string> = {};
    if (token) headers["x-session-token"] = token;

    const resp = await fetch(
      `${SERVER_API}/api/uploader/employee/${employeeId}/monthly-summary?${qs.toString()}`,
      { headers }
    );

    const data = await resp.json().catch(() => ({}));

    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error("monthly-summary proxy error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
