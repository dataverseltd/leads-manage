import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import LoginToken from "@/models/LoginToken";
import crypto from "crypto";

interface Membership {
  role: string;
  companyId?: string;
  active?: boolean;
}

export async function POST(req: NextRequest) {
  await connectDB();

  // ✅ Verify requester is admin/superadmin
  const authToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const role = typeof authToken?.role === "string" ? authToken.role : null;
  const userIdFromToken =
    typeof authToken?.userId === "string" ? authToken.userId : null;

  if (!role || !["admin", "superadmin"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  // ✅ Prevent self-link generation
  if (userIdFromToken === userId) {
    return NextResponse.json(
      { error: "You cannot generate a secure login link for yourself." },
      { status: 400 }
    );
  }

  const user = await User.findById(userId).lean<{
    memberships?: Membership[];
  }>();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const allowedRoles = ["lead_operator", "fb_submitter", "fb_analytics_viewer"];
  const hasAllowedRole = (user.memberships || []).some((m) =>
    allowedRoles.includes(m.role)
  );

  if (!hasAllowedRole) {
    return NextResponse.json(
      { error: "This user is not eligible for secure login link." },
      { status: 400 }
    );
  }

  // ✅ Generate secure token (12 hours)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

  await LoginToken.create({ userId, token, expiresAt });

  const baseUrl = process.env.NEXTAUTH_URL || "https://leads-manage.vercel.app";
  const link = `${baseUrl}/secure-login?token=${token}`;

  return NextResponse.json({ link, expiresAt });
}
