// D:\DataVerse\lead-suite\apps\web\src\app\api\admin\receiver\lead-summary\route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import { PipelineStage, Types } from "mongoose"; // ✅ remove default mongoose import
import Lead from "@/models/Lead";
import User from "@/models/User";

type AppSession = Session & {
  role?: string;
  memberships?: Array<{
    companyId: string;
    roleMode?: "uploader" | "receiver" | "hybrid";
  }>;
};

// Shape of each row returned by the pipeline
type SummaryRow = {
  userId: Types.ObjectId | null;
  name: string;
  email?: string;
  employeeId?: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  working: number;
  assigned: number;
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

  // ✅ Strongly type $match without 'any'
  const match: { assignedCompanyId: Types.ObjectId; workingDay?: string } = {
    assignedCompanyId: new Types.ObjectId(companyId),
  };
  if (day) match.workingDay = day;

  // ✅ Explicit pipeline typing
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
        from: User.collection.name,
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

  // ✅ No 'any' cast; also get typed rows back
  const summary = await Lead.aggregate<SummaryRow>(pipeline);
  return NextResponse.json({ success: true, summary });
}
