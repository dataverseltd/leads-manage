import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import type { PipelineStage } from "mongoose";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const userId = (session as any).userId as string;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        $expr: { $eq: [{ $toString: "$assigned_to" }, userId] },
      } as any,
    },
    { $group: { _id: "$workingDay" } },
    { $sort: { _id: -1 as 1 | -1 } },
  ];

  const rows = await Lead.aggregate(pipeline);
  const days = rows.map((r) => r._id).filter(Boolean);
  return NextResponse.json(days);
}
