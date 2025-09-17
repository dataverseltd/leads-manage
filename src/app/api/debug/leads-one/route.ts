import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";

export async function GET() {
  await connectDB();
  const one = await Lead.findOne({})
    .select("_id assigned_to workingDay lead_status")
    .lean();
  return NextResponse.json(one || null);
}
