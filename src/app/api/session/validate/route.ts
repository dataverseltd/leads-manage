// src/app/api/session/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

interface LeanUser {
  _id: string;
  isLoggedIn?: boolean;
  currentSessionToken?: string;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !token.userId) {
      return NextResponse.json({ valid: false });
    }

    const user = await User.findById(token.userId)
      .select("isLoggedIn currentSessionToken")
      .lean<LeanUser>();

    // ✅ Enforce logout if missing or mismatched session
    if (
      !user ||
      !user.isLoggedIn ||
      !user.currentSessionToken ||
      user.currentSessionToken !== token.sessionToken
    ) {
      const res = NextResponse.json({ valid: false });
      res.cookies.set("next-auth.session-token", "", { maxAge: 0 });
      res.cookies.set("__Secure-next-auth.session-token", "", { maxAge: 0 });
      res.cookies.set("next-auth.csrf-token", "", { maxAge: 0 });
      return res;
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("❌ Session validation failed:", err);
    return NextResponse.json({ valid: false });
  }
}
