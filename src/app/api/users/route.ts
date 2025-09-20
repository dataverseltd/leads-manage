// D:\DataVerse\lead-suite\apps\web\src\app\api\users\route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://localhost:4000";

type AppSession = Session & {
  userId?: string;
  role?: string;
  activeCompanyId?: string;
  memberships?: Array<{ role?: string }>;
};

type JsonObject = Record<string, unknown>;
const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function getCompanyId(
  req: Request,
  session: AppSession | null
): string | undefined {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ||
    req.headers.get("x-company-id") ||
    session?.activeCompanyId ||
    undefined
  );
}

// Parse a cookie value from the raw Cookie header
function getCookieFromHeader(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  // split by ;, trim, and match name=
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (decodeURIComponent(k) === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

// Read the real NextAuth session token (dev vs prod names)
function readSessionTokenFromRequest(req: Request): string {
  return (
    getCookieFromHeader(req, "__Secure-next-auth.session-token") ??
    getCookieFromHeader(req, "next-auth.session-token") ??
    ""
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

function pickCreateUserPayload(src: unknown): CreateUserPayloadOut {
  const out: CreateUserPayloadOut = {};
  if (!isPlainObject(src)) return out;

  if (typeof src.name === "string") out.name = src.name;
  if (typeof src.email === "string") out.email = src.email;
  if (typeof src.employeeId === "string") out.employeeId = src.employeeId;
  if (typeof src.password === "string") out.password = src.password;
  if (typeof src.role === "string") out.role = src.role;

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
  const companyId = getCompanyId(req, session);
  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 }
    );
  }

  // Block cross-company creation attempts via body
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

  // Optional role guard (server should also enforce)
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

  // ✅ Real NextAuth cookie token from request
  const sessionToken = readSessionTokenFromRequest(req);

  const resp = await fetch(`${SERVER_API}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": sessionToken, // authenticateJWT/sessionAuth path
      "x-company-id": companyId, // membership scope
      "x-user-id": session.userId || "", // proxyUser fast-path
      "x-role": session.role || "",
      "x-debug-id": `users-create-${Date.now()}`,
    },
    body: JSON.stringify(forwardBody),
  });

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
