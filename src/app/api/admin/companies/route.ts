export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";
import { Types } from "mongoose";

/** Session fields we add via NextAuth callbacks */
type AppSession = Session & {
  userId?: string;
  role?: string;
  activeCompanyId?: string;
};

/** Minimal shape of a membership embedded on User */
type Membership = {
  companyId?: Types.ObjectId;
  role?: "superadmin" | "admin" | "employee" | string;
  can_distribute_leads?: boolean;
};

/** Minimal User shape we need (from .lean()) */
type UserLean = {
  _id: Types.ObjectId;
  email?: string | null;
  memberships?: Membership[];
};

/** Projection result shape we return for companies */
type CompanyLean = {
  _id: Types.ObjectId;
  name: string;
  code: string;
  active: boolean;
  roleMode: "uploader" | "receiver" | "hybrid";
};

/** Query object for Company.find we build here */
type CompanyFilter = {
  active?: boolean;
  _id?: { $in: Types.ObjectId[] };
};

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
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Prefer userId added by NextAuth callbacks; fallback to email
    const userId: string | undefined = session.userId;
    const email: string | null = session.user?.email ?? null;

    const userDoc: UserLean | null =
      (userId && (await User.findById(userId).lean<UserLean>())) ||
      (email && (await User.findOne({ email }).lean<UserLean>())) ||
      null;

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const onlyActive = url.searchParams.get("active") === "1";
    const need = url.searchParams.get("need"); // "distribute" | undefined
    const scope = url.searchParams.get("scope"); // "memberships" | undefined

    const memberships: Membership[] = Array.isArray(userDoc.memberships)
      ? userDoc.memberships
      : [];

    const isSuperadmin = memberships.some((m) => m?.role === "superadmin");

    // Companies query base
    const filter: CompanyFilter = {};
    if (onlyActive) filter.active = true;

    // Build user-scoped company ids from memberships
    const allMembershipCompanyIds: Types.ObjectId[] = memberships
      .map((m) => m.companyId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    // If need=distribute, filter memberships by permissions
    const distributableCompanyIds: Types.ObjectId[] =
      need === "distribute"
        ? memberships
            .filter(
              (m) =>
                m?.role === "superadmin" ||
                m?.role === "admin" ||
                !!m?.can_distribute_leads
            )
            .map((m) => m.companyId)
            .filter((id): id is Types.ObjectId => Boolean(id))
        : allMembershipCompanyIds;

    // Common projection: include roleMode so the UI can resolve company mode correctly
    const PROJECTION = {
      name: 1 as const,
      code: 1 as const,
      active: 1 as const,
      roleMode: 1 as const,
    };

    // If scope=memberships, ALWAYS restrict to membership companies (even for superadmin)
    if (scope === "memberships") {
      if (
        distributableCompanyIds.length === 0 &&
        allMembershipCompanyIds.length === 0
      ) {
        return NextResponse.json([], { status: 200 });
      }
      filter._id = {
        $in:
          need === "distribute"
            ? distributableCompanyIds
            : allMembershipCompanyIds,
      };
      const companies = await Company.find(filter, PROJECTION)
        .sort({ name: 1 })
        .lean<CompanyLean[]>();
      return NextResponse.json(companies, { status: 200 });
    }

    // scope != memberships
    if (isSuperadmin) {
      // Superadmin sees all unless limited by "need" (we already limited membershipCompanyIds when need=distribute)
      if (need === "distribute" && distributableCompanyIds.length) {
        filter._id = { $in: distributableCompanyIds };
      }
      const companies = await Company.find(filter, PROJECTION)
        .sort({ name: 1 })
        .lean<CompanyLean[]>();
      return NextResponse.json(companies, { status: 200 });
    }

    // Non-superadmin: restrict to membership companies
    if (allMembershipCompanyIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    filter._id = {
      $in:
        need === "distribute"
          ? distributableCompanyIds
          : allMembershipCompanyIds,
    };

    const companies = await Company.find(filter, PROJECTION)
      .sort({ name: 1 })
      .lean<CompanyLean[]>();
    return NextResponse.json(companies, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
