import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import { Types } from "mongoose";

type AppSession = Session & { userId?: string };

export async function GET() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  const userId = session.userId;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  // Get all distinct workingDay values for leads assigned to this user
  const days = await Lead.distinct<string>("workingDay", {
    assigned_to: new Types.ObjectId(userId),
  });

  // Sort newest first (assuming YYYY-MM-DD strings)
  days.sort((a, b) => b.localeCompare(a));

  return NextResponse.json(days, { status: 200 });
}
