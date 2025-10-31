import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // ✅ Token exists → user is logged in
    if (token && token.userId) {
      return NextResponse.json({ valid: true });
    }

    // ✅ Also allow cases where magic-login cookie exists but not yet hydrated
    const cookie =
      req.cookies.get("next-auth.session-token") ||
      req.cookies.get("__Secure-next-auth.session-token");
    if (cookie?.value) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false });
  } catch (err) {
    return NextResponse.json({ valid: false });
  }
}
