// D:\DataVerse\lead-suite\apps\web\src\app\api\users\route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SERVER_API = process.env.SERVER_API_URL || "http://localhost:4000";

function getCompanyId(req: Request) {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ||
    req.headers.get("x-company-id") ||
    undefined
  );
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

// (optional) allow-list the fields we forward
function pickCreateUserPayload(src: any) {
  const out: any = {};
  if (typeof src?.name === "string") out.name = src.name;
  if (typeof src?.email === "string") out.email = src.email;
  if (typeof src?.employeeId === "string") out.employeeId = src.employeeId;
  if (typeof src?.password === "string") out.password = src.password;
  if (typeof src?.role === "string") out.role = src.role;

  // caps: { canUploadLeads, canReceiveLeads, can_distribute_leads, can_distribute_fbids, can_create_user }
  if (src?.caps && typeof src.caps === "object") {
    const caps = src.caps;
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(req);
  const companyId = getCompanyId(req);
  const sessionToken = (session as any).sessionToken as string | undefined;

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
  if (body?.companyId && body.companyId !== companyId) {
    return NextResponse.json(
      { error: "companyId mismatch between query/header and body" },
      { status: 400 }
    );
  }

  // (optional) second-layer role guard on the edge (server also should enforce)
  const isSuperadmin = !!(session as any)?.memberships?.some(
    (m: any) => m?.role === "superadmin"
  );
  if (body?.role === "superadmin" && !isSuperadmin) {
    return NextResponse.json(
      { error: "Only superadmin can create superadmin users" },
      { status: 403 }
    );
  }

  const forwardBody = pickCreateUserPayload(body || {});

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
