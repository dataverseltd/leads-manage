export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";

/**
 * GET /api/admin/companies
 *
 * Query params:
 * - active=1              -> only active companies
 * - need=distribute       -> only companies where the user can distribute leads
 * - scope=memberships     -> even for superadmin, restrict to companies the user has a membership in
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Prefer userId added by NextAuth callbacks; fallback to email
    const userId = (session as any).userId as string | undefined;
    const email = session.user.email || null;

    const userDoc =
      (userId && (await User.findById(userId).lean())) ||
      (email && (await User.findOne({ email }).lean()));

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const onlyActive = url.searchParams.get("active") === "1";
    const need = url.searchParams.get("need"); // "distribute" | undefined
    const scope = url.searchParams.get("scope"); // "memberships" | undefined

    const memberships = Array.isArray(userDoc.memberships)
      ? userDoc.memberships
      : [];
    const isSuperadmin = memberships.some((m: any) => m?.role === "superadmin");

    // Companies query base
    const q: any = {};
    if (onlyActive) q.active = true;

    // Build user-scoped company ids from memberships
    let membershipCompanyIds: any[] = memberships
      .map((m: any) => m?.companyId)
      .filter(Boolean);

    // If need=distribute, filter memberships by permissions
    if (need === "distribute") {
      membershipCompanyIds = memberships
        .filter(
          (m: any) =>
            m?.role === "superadmin" ||
            m?.role === "admin" ||
            !!m?.can_distribute_leads
        )
        .map((m: any) => m?.companyId)
        .filter(Boolean);
    }

    // Common projection: include roleMode so the UI can resolve company mode correctly
    const PROJECTION = { name: 1, code: 1, active: 1, roleMode: 1 };

    // If scope=memberships, ALWAYS restrict to membership companies (even for superadmin)
    if (scope === "memberships") {
      if (!membershipCompanyIds.length) {
        return NextResponse.json([], { status: 200 });
      }
      q._id = { $in: membershipCompanyIds };
      const companies = await Company.find(q, PROJECTION)
        .sort({ name: 1 })
        .lean();
      return NextResponse.json(companies, { status: 200 });
    }

    // scope != memberships
    if (isSuperadmin) {
      // Superadmin sees all unless limited by "need" (we already limited membershipCompanyIds when need=distribute)
      if (need === "distribute" && membershipCompanyIds.length) {
        q._id = { $in: membershipCompanyIds };
      }
      const companies = await Company.find(q, PROJECTION)
        .sort({ name: 1 })
        .lean();
      return NextResponse.json(companies, { status: 200 });
    }

    // Non-superadmin: restrict to membership companies
    if (!membershipCompanyIds.length) {
      return NextResponse.json([], { status: 200 });
    }
    q._id = { $in: membershipCompanyIds };

    const companies = await Company.find(q, PROJECTION)
      .sort({ name: 1 })
      .lean();
    return NextResponse.json(companies, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
