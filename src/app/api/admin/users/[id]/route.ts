import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

type AppSession = Session & { sessionToken?: string };
type JsonObject = Record<string, unknown>;
const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // 👈 make it a Promise
) {
  const { id } = await params; // 👈 await it

  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = session.sessionToken;

  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    bodyUnknown = {};
  }
  const body: JsonObject = isPlainObject(bodyUnknown) ? bodyUnknown : {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["x-session-token"] = token;

  const resp = await fetch(`${SERVER_API}/admin/users/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
