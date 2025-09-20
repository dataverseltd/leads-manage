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
  const { pathname, search } = req.nextUrl;

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
    // Preserve full callback (path + query)
    const callback = `${pathname}${search || ""}`;
    signInUrl.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(signInUrl);
  }

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

  /* ---------- Rule 2: Guard the new Receiver Lead Summary page ---------- */
  if (isReceiverSummaryPage) {
    // Only admins/superadmins who have any receiver/hybrid membership
    if (!isAdmin || !hasReceiverCompany) {
      return NextResponse.redirect(new URL("/unauthorize", req.url));
    }
    return NextResponse.next();
  }

  /* ---------- Rule 3: Blocked roles from any /dashboard/admin/* ---------- */
  if (isAdminArea && role && BLOCKED_ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/unauthorize", req.url));
  }

  /* ---------- Rule 4: Single-membership uploader-only admin restriction ---------- */
  const isSingleMembershipUploaderOnly =
    memberships.length === 1 && memberships[0]?.roleMode === "uploader";

  if (isSingleMembershipUploaderOnly && role === "admin") {
    // Keep your existing targeted blocks
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

export const config = {
  matcher: ["/dashboard/:path*"], // cover all dashboard pages
};
