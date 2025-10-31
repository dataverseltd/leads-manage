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
  sessionToken?: string;
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
  const { pathname, search } = req.nextUrl;

  // ✅ Skip static, public, and auth-related routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/favicon") ||
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/secure-login") ||
    pathname.startsWith("/unauthorize")
  ) {
    return NextResponse.next();
  }

  // ✅ Check NextAuth session token
  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AugmentedToken | null;

  // ❌ No token → redirect to sign-in
  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search || ""}`);
    return NextResponse.redirect(signInUrl);
  }

  /* ---------------- Role logic ---------------- */
  const role = token.role;
  const memberships = token.memberships || [];
  const isAdmin = role === "admin" || role === "superadmin";
  const hasReceiverCompany = memberships.some(
    (m) => m.active && (m.roleMode === "receiver" || m.roleMode === "hybrid")
  );

  const isAdminArea = pathname.startsWith("/dashboard/admin");
  const isReceiverSummaryPage = pathname.startsWith(
    "/dashboard/admin/receiver-lead-summary"
  );

  /* ---------- Rule 1: Superadmin → full access ---------- */
  if (role === "superadmin") return NextResponse.next();

  /* ---------- Rule 2: Receiver summary protection ---------- */
  if (isReceiverSummaryPage) {
    if (!isAdmin || !hasReceiverCompany) {
      return NextResponse.redirect(new URL("/unauthorize", req.url));
    }
    return NextResponse.next();
  }

  /* ---------- Rule 3: Blocked roles from /dashboard/admin ---------- */
  if (isAdminArea && role && BLOCKED_ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/unauthorize", req.url));
  }

  /* ---------- Rule 4: Uploader-only admin restriction ---------- */
  const isSingleMembershipUploaderOnly =
    memberships.length === 1 && memberships[0]?.roleMode === "uploader";

  if (isSingleMembershipUploaderOnly && role === "admin") {
    const restrictedPages = new Set([
      "/dashboard/admin/screenshots",
      "/dashboard/signup-summary",
      "/dashboard/admin/distribution",
    ]);
    if (restrictedPages.has(pathname)) {
      return NextResponse.redirect(new URL("/unauthorize", req.url));
    }
  }

  return NextResponse.next();
}

/* ---------------- Config ---------------- */
// ✅ Matcher rewritten to exclude all public & auth routes cleanly
export const config = {
  matcher: [
    "/dashboard/:path*", // protect all dashboard routes
    "/((?!api|_next|public|sign-in|secure-login|unauthorize|favicon).*)",
  ],
};
