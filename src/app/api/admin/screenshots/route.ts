// D:\DataVerse\lead-suite\apps\web\src\app\api\admin\screenshots\route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const SERVER_API = process.env.SERVER_API_URL || "http://127.0.0.1:4000";

/** Align with your roles */
type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

/** Optional user fields you store in the session */
type SessionUserExtras = {
  id?: string | null;
  role?: Role | string | null;
  activeCompanyId?: string | null;
  sessionToken?: string | null;
};

/** Your session sometimes carries fields both at root and under user */
type CustomSession = Session & {
  user?: Session["user"] & SessionUserExtras;
  userId?: string | null;
  role?: Role | string | null;
  activeCompanyId?: string | null;
  sessionToken?: string | null;
};

/** Helper to fetch a value from either session root or session.user */
function getSessionValue(
  session: CustomSession | null,
  keys: Array<keyof CustomSession | `user.${keyof SessionUserExtras}`>
): string {
  if (!session) return "";
  for (const k of keys) {
    if (k.startsWith("user.")) {
      const uk = k.split(".")[1] as keyof SessionUserExtras;
      const v = session.user?.[uk];
      if (typeof v === "string") return v;
      if (v != null) return String(v);
    } else {
      const v = session[k as keyof CustomSession];
      if (typeof v === "string") return v;
      if (v != null) return String(v);
    }
  }
  return "";
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(
      authOptions
    )) as CustomSession | null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build target URL (pass-through query: workingDay, status, q, limit, etc.)
    const url = new URL(req.url);
    const qs = url.search; // includes leading "?" or "" if none
    const target = `${SERVER_API}/api/admin/screenshots${qs || ""}`;

    // Safely read headers from session with fallbacks
    const xUserId = getSessionValue(session, ["userId", "user.id"]);
    const xCompanyId = getSessionValue(session, [
      "activeCompanyId",
      "user.activeCompanyId",
    ]);
    const xRole = getSessionValue(session, ["role", "user.role"]);

    const r = await fetch(target, {
      headers: {
        "x-user-id": xUserId,
        "x-company-id": xCompanyId,
        "x-role": xRole,
      },
      // credentials: "include", // uncomment if your upstream needs cookies
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
