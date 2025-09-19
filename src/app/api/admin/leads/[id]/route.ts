export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import { authOptions } from "@/lib/auth-options";

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

type Params = { id: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewAll(session as SessionLike)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();

    const lead = await Lead.findById(id, {
      fb_id_name: 1,
      client_name: 1,
      number: 1,
      rent: 1,
      house_apt: 1,
      house_apt_details: 1,
      address: 1,
      post_link: 1,
      screenshot_link: 1,
      signup_screenshot_link: 1,
      lead_status: 1,
      submitted_by: 1,
      assigned_to: 1,
      assigned_at: 1,
      workingDay: 1,
      sourceCompanyId: 1,
      targetCompanyId: 1,
      assignedCompanyId: 1,
      createdAt: 1,
      updatedAt: 1,
    })
      .populate([
        {
          path: "submitted_by",
          select: "name email employeeId",
          options: { lean: true },
        },
        {
          path: "assigned_to",
          select: "name email employeeId",
          options: { lean: true },
        },
      ])
      .lean();

    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: lead });
  } catch (err: unknown) {
    console.error("GET /api/admin/leads/[id] failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
