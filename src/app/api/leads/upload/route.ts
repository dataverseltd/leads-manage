export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyIdFromReq,
  getUserForSession,
  userHasUploadPermission,
} from "../../admin/distribution/_utils";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

export async function POST(req: NextRequest) {
  // 1) get session/user first
  const { session, userDoc } = await getUserForSession();

  // 2) compute companyId with fallback to user's first membership
  let companyId = getCompanyIdFromReq(req);
  if (!companyId && userDoc?.memberships?.length) {
    const first = userDoc.memberships[0];
    if (first?.companyId) companyId = String(first.companyId);
  }

  // 3) permission check now that we have companyId + userDoc
  if (!session || !userDoc || !userHasUploadPermission(userDoc, companyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4) forward to server
  const body = await req.json();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (companyId) headers["x-company-id"] = companyId;
  if (
    (userDoc as { currentSessionToken?: string } | null)?.currentSessionToken
  ) {
    headers["x-session-token"] = String(
      (userDoc as { currentSessionToken?: string }).currentSessionToken
    );
  }

  const upstream = await fetch(`${SERVER_API}/api/leads/upload`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const contentType = upstream.headers.get("content-type") || "";
  const text = await upstream.text();

  let data: unknown;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      // Upstream said JSON but sent invalid payload; return a clear wrapper
      data = { error: "Invalid JSON from upstream", raw: text || null };
    }
  } else {
    data = { note: text || null };
  }

  return NextResponse.json(data, { status: upstream.status });
}
