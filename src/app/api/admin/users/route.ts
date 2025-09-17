import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).sessionToken;
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const resp = await fetch(
    `${SERVER_API}/admin/users?search=${encodeURIComponent(search)}`,
    {
      headers: { "x-session-token": token },
    }
  );
  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (session as any).sessionToken;
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${SERVER_API}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
