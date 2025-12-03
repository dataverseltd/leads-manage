export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ employeeId: string }> }
) {
  // ✔ WAIT FOR PARAMS (required by Next.js)
  const { employeeId } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = session.sessionToken;

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || "";
  const companyId = url.searchParams.get("companyId") || "";

  if (!month || !companyId) {
    return NextResponse.json(
      { error: "month and companyId are required" },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    "x-session-token": token,
  };

  const resp = await fetch(
    `${SERVER_API}/api/uploader/employee/${employeeId}/stats?month=${month}&companyId=${companyId}`,
    { headers }
  );

  const data = await resp.json().catch(() => ({}));

  return NextResponse.json(data, { status: resp.status });
}
