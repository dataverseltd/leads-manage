export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyIdFromReq,
  getUserForSession,
  userHasDistributionPermission,
} from "../../_utils";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

export async function POST(req: NextRequest) {
  const companyId = getCompanyIdFromReq(req);
  const { session, userDoc } = await getUserForSession();

  if (
    !session ||
    !userDoc ||
    !userHasDistributionPermission(userDoc, companyId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json(); // { active: boolean }
  const qs = companyId ? `?companyId=${companyId}` : "";

  const upstream = await fetch(
    `${SERVER_API}/api/admin/distribution/today/toggle${qs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        active: Boolean(body?.active),
        activatedBy: String(userDoc._id),
      }),
    }
  );

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
