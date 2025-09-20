export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import mongoose from "mongoose";

type AppSession = Session & {
  role?: string;
  memberships?: Array<{ companyId: string }>;
};

export async function GET() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );

  // root role must be admin/superadmin
  if (!(session.role === "admin" || session.role === "superadmin")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const companyIds = (session.memberships || [])
    .map((m) => m.companyId)
    .filter(Boolean);
  if (!companyIds.length)
    return NextResponse.json({ success: true, companies: [] });

  await connectDB();

  // Authoritative filter: only receiver/hybrid companies among the user’s memberships
  const companies = await Company.find({
    _id: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) },
    active: true,
    roleMode: { $in: ["receiver", "hybrid"] },
  })
    .select({ _id: 1, name: 1, roleMode: 1 })
    .lean();

  return NextResponse.json({ success: true, companies });
}
