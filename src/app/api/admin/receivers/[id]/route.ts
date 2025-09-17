export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyIdFromReq,
  getUserForSession,
  userHasDistributionPermission,
} from "@/app/api/admin/distribution/_utils";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

type JsonObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function readCompanyId(body: JsonObject): string | undefined {
  const v = body["companyId"];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const qsCompanyId = getCompanyIdFromReq(req); // from ?companyId or header

  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    bodyUnknown = {};
  }
  const origBody: JsonObject = isPlainObject(bodyUnknown) ? bodyUnknown : {};

  const effectiveCompanyId = qsCompanyId ?? readCompanyId(origBody); // fall back to body

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

  // Optional session token if present on your user model
  const maybeToken = (userDoc as unknown as { currentSessionToken?: string })
    ?.currentSessionToken;
  if (maybeToken) headers["x-session-token"] = String(maybeToken);

  // only include companyId if we have one
  const payload: JsonObject = effectiveCompanyId
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
