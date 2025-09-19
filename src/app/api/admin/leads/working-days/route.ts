export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import { authOptions } from "@/lib/auth-options";

/** Minimal shape we care about from your session */
type SessionLike = {
  role?: string;
  caps?: Record<string, unknown>;
};

function canViewAll(session: SessionLike | null | undefined): boolean {
  return (
    session?.role === "superadmin" ||
    session?.role === "admin" ||
    Boolean(
      session?.caps &&
        (session.caps as Record<string, boolean>).can_view_all_leads
    )
  );
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewAll(session as SessionLike)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    // Ask Mongoose to give us strings, then narrow with a type guard
    const raw = await Lead.distinct<string>("workingDay", {});
    const list = raw.filter(isNonEmptyString);

    // Sort desc (YYYY-MM-DD format sorts lexicographically)
    list.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

    return NextResponse.json({
      workingDays: list.slice(0, 365),
      count: list.length,
    });
  } catch (err: unknown) {
    // Keep logs useful without using `any`
    console.error("GET /api/admin/leads/working-days failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
