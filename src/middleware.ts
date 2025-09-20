// apps/web/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/* ---------------- Types ---------------- */
type RoleMode = "uploader" | "receiver" | "hybrid";
type Role =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer";

type MembershipView = {
  companyId: string;
  role: Role;
  roleMode: RoleMode;
  active: boolean;
};

type AugmentedToken = {
  userId?: string;
  role?: Role;
  roleMode?: RoleMode;
  memberships?: MembershipView[];
};

/* ---------------- Constants ---------------- */
const BLOCKED_ADMIN_ROLES: Role[] = [
  "lead_operator",
  "fb_submitter",
  "fb_analytics_viewer",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static/public
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname === "/sign-in" ||
    pathname === "/unauthorize" ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AugmentedToken | null;

  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role;
  const memberships = token.memberships || [];

  /* ---------- Rule 1: Superadmin → full access ---------- */
  if (role === "superadmin") return NextResponse.next();

  /* ---------- Rule 2: Multiple memberships w/ receiver company → allow ---------- */
  if (
    memberships.length > 1 &&
    memberships.some((m) => m.roleMode === "receiver")
  ) {
    return NextResponse.next();
  }

  /* ---------- Rule 3: Blocked roles from any /dashboard/admin/* ---------- */
  if (
    pathname.startsWith("/dashboard/admin") &&
    role &&
    BLOCKED_ADMIN_ROLES.includes(role)
  ) {
    return NextResponse.redirect(new URL("/unauthorize", req.url));
  }

  /* ---------- Rule 4: Single-membership uploader-only admin restriction ---------- */
  const isSingleMembershipUploaderOnly =
    memberships.length === 1 && memberships[0]?.roleMode === "uploader";
  if (isSingleMembershipUploaderOnly && role === "admin") {
    // Only block the three specific pages
    const restrictedPages = [
      "/dashboard/admin/screenshots",
      "/dashboard/signup-summary",
      "/dashboard/admin/distribution",
    ];
    if (restrictedPages.includes(pathname)) {
      return NextResponse.redirect(new URL("/unauthorize", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"], // cover all dashboard pages
};
