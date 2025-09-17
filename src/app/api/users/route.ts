// D:\DataVerse\lead-suite\apps\web\src\app\api\users\route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SERVER_API = process.env.SERVER_API_URL || "http://localhost:4000";

type AppSession = Session & {
  sessionToken?: string;
  memberships?: Array<{ role?: string }>;
};

type JsonObject = Record<string, unknown>;
const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function getCompanyId(req: Request): string | undefined {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ||
    req.headers.get("x-company-id") ||
    undefined
  );
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

type CreateUserPayloadOut = {
  name?: string;
  email?: string;
  employeeId?: string;
  password?: string;
  role?: string;
  caps?: {
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
    can_distribute_leads: boolean;
    can_distribute_fbids: boolean;
    can_create_user: boolean;
  };
};

// (optional) allow-list the fields we forward
function pickCreateUserPayload(src: unknown): CreateUserPayloadOut {
  const out: CreateUserPayloadOut = {};
  if (!isPlainObject(src)) return out;

  if (typeof src.name === "string") out.name = src.name;
  if (typeof src.email === "string") out.email = src.email;
  if (typeof src.employeeId === "string") out.employeeId = src.employeeId;
  if (typeof src.password === "string") out.password = src.password;
  if (typeof src.role === "string") out.role = src.role;

  // caps: { canUploadLeads, canReceiveLeads, can_distribute_leads, can_distribute_fbids, can_create_user }
  if (isPlainObject(src.caps)) {
    const caps = src.caps as JsonObject;
    out.caps = {
      canUploadLeads: !!caps.canUploadLeads,
      canReceiveLeads: !!caps.canReceiveLeads,
      can_distribute_leads: !!caps.can_distribute_leads,
      can_distribute_fbids: !!caps.can_distribute_fbids,
      can_create_user: !!caps.can_create_user,
    };
  }

  return out;
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyUnknown = await readBody(req);
  const companyId = getCompanyId(req);
  const sessionToken = session.sessionToken;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Unauthorized: missing sessionToken" },
      { status: 401 }
    );
  }
  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 }
    );
  }

  // 🚫 Never trust body.companyId — ignore it to prevent cross-company creation
  if (
    isPlainObject(bodyUnknown) &&
    typeof bodyUnknown.companyId === "string" &&
    bodyUnknown.companyId !== companyId
  ) {
    return NextResponse.json(
      { error: "companyId mismatch between query/header and body" },
      { status: 400 }
    );
  }

  // (optional) second-layer role guard on the edge (server also should enforce)
  const isSuperadmin =
    Array.isArray(session.memberships) &&
    session.memberships.some((m) => m?.role === "superadmin");

  if (
    isPlainObject(bodyUnknown) &&
    typeof bodyUnknown.role === "string" &&
    bodyUnknown.role === "superadmin" &&
    !isSuperadmin
  ) {
    return NextResponse.json(
      { error: "Only superadmin can create superadmin users" },
      { status: 403 }
    );
  }

  const forwardBody = pickCreateUserPayload(bodyUnknown);

  const resp = await fetch(`${SERVER_API}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": sessionToken,
      "x-company-id": companyId, // <-- authoritative company scope
    },
    body: JSON.stringify(forwardBody),
  });

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
