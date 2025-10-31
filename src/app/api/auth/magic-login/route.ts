import { encode } from "next-auth/jwt"; // ✅ use NextAuth’s encoder
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import LoginToken from "@/models/LoginToken";
import User from "@/models/User";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  await connectDB();
  const { token } = await req.json();
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const loginToken = await LoginToken.findOne({ token });
  if (!loginToken || loginToken.used)
    return NextResponse.json({ error: "Invalid or used" }, { status: 400 });
  if (loginToken.expiresAt < new Date())
    return NextResponse.json({ error: "Expired" }, { status: 400 });

  const user = await User.findById(loginToken.userId);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  loginToken.used = true;
  await loginToken.save();

  const sessionToken =
    crypto.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  user.currentSessionToken = sessionToken;
  user.isLoggedIn = true;
  await user.save();

  // ✅ Generate a proper JWE-encoded token compatible with NextAuth
  const signedToken = await encode({
    token: {
      name: user.name,
      email: user.email,
      sub: user._id.toString(),
      userId: user._id.toString(),
      sessionToken,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 60 * 60 * 11,
  });

  const res = NextResponse.json({ ok: true });

  const cookieConfig = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 11,
  };

  res.cookies.set("next-auth.session-token", signedToken, {
    ...cookieConfig,
    secure: process.env.NODE_ENV === "production",
  });

  res.cookies.set("__Secure-next-auth.session-token", signedToken, {
    ...cookieConfig,
    secure: true,
  });

  return res;
}
