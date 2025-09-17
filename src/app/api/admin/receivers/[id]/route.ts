export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyIdFromReq,
  getUserForSession,
  userHasDistributionPermission,
} from "@/app/api/admin/distribution/_utils";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const qsCompanyId = getCompanyIdFromReq(req); // from ?companyId or header
  const origBody = await req.json().catch(() => ({} as any));

  const effectiveCompanyId = qsCompanyId || origBody.companyId; // fall back to body

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (effectiveCompanyId) headers["x-company-id"] = String(effectiveCompanyId);

  const { session, userDoc } = await getUserForSession();
  if (
    !session ||
    !userDoc ||
    !userHasDistributionPermission(userDoc, effectiveCompanyId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (userDoc.currentSessionToken)
    headers["x-session-token"] = String(userDoc.currentSessionToken);

  // only include companyId if we have one
  const payload = effectiveCompanyId
    ? { ...origBody, companyId: effectiveCompanyId }
    : origBody;

  const upstream = await fetch(
    `${SERVER_API}/api/admin/receivers/${params.id}`,
    {
      method: "PATCH",
      headers,
      cache: "no-store",
      body: JSON.stringify(payload),
    }
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
