export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyIdFromReq,
  getUserForSession,
  userHasDistributionPermission,
} from "@/app/api/admin/distribution/_utils";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

export async function POST(req: NextRequest) {
  const { session, userDoc } = await getUserForSession();
  if (!session || !userDoc) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const companyId = String(body?.companyId || getCompanyIdFromReq(req) || "");

  if (!userHasDistributionPermission(userDoc, companyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (userDoc.currentSessionToken)
    headers["x-session-token"] = String(userDoc.currentSessionToken);

  const upstream = await fetch(`${SERVER_API}/api/admin/receivers/bulk`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
