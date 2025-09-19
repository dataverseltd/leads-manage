// D:\DataVerse\lead-suite\apps\web\src\app\api\admin\screenshots\review\route.ts

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const RAW = process.env.SERVER_API_URL || "http://127.0.0.1:4000";
const SERVER_API = RAW.replace("localhost", "127.0.0.1");

function now() {
  return new Date().toISOString();
}

/** Extend Session.user with our optional fields used in headers/logs */
type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

type SessionUserExtras = {
  id?: string | null;
  role?: Role | string | null;
  activeCompanyId?: string | null;
  sessionToken?: string | null;
};

type CustomSession = Session & {
  user?: Session["user"] & SessionUserExtras;
  /** Some legacy fields we sometimes stash at root on the server */
  userId?: string | null;
  role?: Role | string | null;
  activeCompanyId?: string | null;
  sessionToken?: string | null;
};

/** Safely get values from session with multiple fallbacks */
function getSessionValue(
  session: CustomSession | null,
  keys: Array<keyof CustomSession | `user.${keyof SessionUserExtras}`>
): string {
  if (!session) return "";
  for (const k of keys) {
    if (k.startsWith("user.")) {
      const uk = k.split(".")[1] as keyof SessionUserExtras;
      const val = session.user?.[uk];
      if (typeof val === "string") return val;
      if (val != null) return String(val);
    } else {
      const val = session[k as keyof CustomSession];
      if (typeof val === "string") return val;
      if (val != null) return String(val);
    }
  }
  return "";
}

export async function PATCH(req: NextRequest) {
  const started = Date.now();
  const debugId = `rev-${started}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const session = (await getServerSession(
      authOptions
    )) as CustomSession | null;
    if (!session) {
      console.log(`[${now()}][${debugId}] ❌ No session`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodyText = await req.text();

    const xUserId = getSessionValue(session, ["userId", "user.id"]);
    const xCompanyId = getSessionValue(session, [
      "activeCompanyId",
      "user.activeCompanyId",
    ]);
    const xRole = getSessionValue(session, ["role", "user.role"]);
    const xSessionToken = getSessionValue(session, [
      "sessionToken",
      "user.sessionToken",
    ]);

    console.log(
      `[${now()}][${debugId}] → PROXY PATCH ${SERVER_API}/employee/screenshots/review`
    );
    console.log(`[${now()}][${debugId}]   headers:`, {
      "x-user-id": xUserId,
      "x-company-id": xCompanyId,
      "x-role": xRole,
    });

    try {
      const parsed = JSON.parse(bodyText) as unknown;
      console.log(`[${now()}][${debugId}]   body:`, parsed);
    } catch {
      console.log(`[${now()}][${debugId}]   body: <non-JSON>`);
    }

    // timeout guard (20s)
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20_000);

    const r = await fetch(`${SERVER_API}/employee/screenshots/review`, {
      method: "PATCH",
      cache: "no-store",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        "x-debug-id": debugId,
        "x-user-id": xUserId,
        "x-company-id": xCompanyId,
        "x-role": xRole,
        "x-session-token": xSessionToken,
      },
      body: bodyText,
    }).finally(() => clearTimeout(t));

    const text = await r.text();

    console.log(
      `[${now()}][${debugId}] ← PROXY RESP ${r.status} in ${
        Date.now() - started
      }ms`
    );
    try {
      const parsed = JSON.parse(text) as unknown;
      console.log(`[${now()}][${debugId}]   resp body:`, parsed);
    } catch {
      console.log(
        `[${now()}][${debugId}]   resp body: <non-JSON len=${text.length}>`
      );
    }

    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Proxy error";
    console.error(`[${now()}][${debugId}] 💥 PROXY ERROR:`, message);
    return NextResponse.json({ error: message, debugId }, { status: 500 });
  }
}
