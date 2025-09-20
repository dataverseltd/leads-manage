export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Lead from "@/models/Lead";

type AppSession = Session & {
  role?: string;
  memberships?: Array<{
    companyId: string;
    roleMode?: "uploader" | "receiver" | "hybrid";
  }>;
};

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  if (!(session.role === "admin" || session.role === "superadmin")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  if (!companyId)
    return NextResponse.json(
      { success: false, error: "companyId required" },
      { status: 400 }
    );

  // Verify this admin actually has a receiver-mode membership for this company
  const hasReceiver = (session.memberships || []).some(
    (m) =>
      String(m.companyId) === String(companyId) && m.roleMode === "receiver"
  );
  if (!hasReceiver) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await connectDB();
  const days: string[] = await Lead.distinct("workingDay", {
    assignedCompanyId: new mongoose.Types.ObjectId(companyId),
  });
  days.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  return NextResponse.json({ success: true, days });
}
