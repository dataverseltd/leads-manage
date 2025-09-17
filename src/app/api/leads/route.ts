export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
function getCompanyId(req: Request, body?: any) {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ||
    body?.companyId ||
    req.headers.get("x-company-id") ||
    undefined
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json(
        { error: "Unauthorized: no session" },
        { status: 401 }
      );

    const body = await readBody(req);
    const companyId = getCompanyId(req, body);
    const sessionToken = (session as any).sessionToken as string | undefined;
    if (!sessionToken)
      return NextResponse.json(
        { error: "Unauthorized: missing sessionToken" },
        { status: 401 }
      );
    if (!companyId)
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );

    const resp = await fetch(`${SERVER_API}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
        "x-company-id": companyId,
      },
      body: JSON.stringify(body ?? {}),
    });

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    // Map low-level network errors into a clear message
    const msg =
      err?.code === "ECONNREFUSED"
        ? `Cannot reach server at ${SERVER_API}. Is it running?`
        : err?.message || "Proxy error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json(
        { error: "Unauthorized: no session" },
        { status: 401 }
      );

    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") || undefined;
    const sessionToken = (session as any).sessionToken as string | undefined;
    if (!sessionToken)
      return NextResponse.json(
        { error: "Unauthorized: missing sessionToken" },
        { status: 401 }
      );
    if (!companyId)
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );

    const resp = await fetch(
      `${SERVER_API}/api/leads?${url.searchParams.toString()}`,
      {
        headers: {
          "x-session-token": sessionToken,
          "x-company-id": companyId,
        },
      }
    );

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    const msg =
      err?.code === "ECONNREFUSED"
        ? `Cannot reach server at ${SERVER_API}. Is it running?`
        : err?.message || "Proxy error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
