// D:\DataVerse\lead-suite\apps\web\src\app\api\admin\receiver\lead-summary\route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose, { PipelineStage, Types } from "mongoose";
import Lead from "@/models/Lead";
import User from "@/models/User";

type AppSession = Session & {
  role?: string;
  memberships?: Array<{
    companyId: string;
    roleMode?: "uploader" | "receiver" | "hybrid";
  }>;
};

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!(session.role === "admin" || session.role === "superadmin")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  const day = url.searchParams.get("day") || "";

  if (!companyId) {
    return NextResponse.json(
      { success: false, error: "companyId required" },
      { status: 400 }
    );
  }

  // Allow receiver OR hybrid memberships
  const hasReceiver = (session.memberships || []).some(
    (m) =>
      String(m.companyId) === String(companyId) &&
      (m.roleMode === "receiver" || m.roleMode === "hybrid")
  );
  if (!hasReceiver) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await connectDB();

  // Keep typing loose here to satisfy PipelineStage.Match
  const match: Record<string, any> = {
    assignedCompanyId: new Types.ObjectId(companyId),
  };
  if (day) match.workingDay = day;

  // ✅ Explicitly type the pipeline
  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: "$assigned_to",
        total: { $sum: 1 },
        approved: {
          $sum: { $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0] },
        },
        working: {
          $sum: { $cond: [{ $eq: ["$lead_status", "in_progress"] }, 1, 0] },
        },
        assigned: {
          $sum: { $cond: [{ $eq: ["$lead_status", "assigned"] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: User.collection.name, // string
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: { $ifNull: ["$user.name", "Unknown"] },
        email: "$user.email",
        employeeId: "$user.employeeId",
        total: 1,
        approved: 1,
        pending: 1,
        rejected: 1,
        working: 1,
        assigned: 1,
      },
    },
    { $sort: { total: -1, name: 1 } },
  ];

  // Cast pipeline type (already correct) and run
  const summary = await (Lead as any).aggregate(pipeline as PipelineStage[]);
  return NextResponse.json({ success: true, summary });
}
