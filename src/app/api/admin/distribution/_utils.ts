import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db"; // your existing DB connector
import User from "@/models/User"; // web-side user model

export function getCompanyIdFromReq(req: NextRequest) {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ||
    req.headers.get("x-company-id") ||
    undefined
  );
}

function hasMembershipPermission(m: any) {
  const isAdmin = m?.role === "superadmin" || m?.role === "admin";
  const canDistribute = !!m?.can_distribute_leads;
  return isAdmin || canDistribute;
}

export async function getUserForSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { session: null, userDoc: null };

  const id = (session.user as any)?._id || (session.user as any)?.id || null;
  const email = session.user.email || null;
  // Temporarily inside GET/POST after getUserForSession()

  await connectDB();

  let userDoc = null;
  if (id && mongoose.isValidObjectId(id)) {
    userDoc = await User.findById(id).lean();
  }
  if (!userDoc && email) {
    userDoc = await User.findOne({ email }).lean();
  }

  return { session, userDoc };
}

/**
 * Returns true if the user has distribution permission.
 * - If companyId provided: check that specific membership.
 * - If companyId not provided: allow if ANY membership grants permission.
 */
export function userHasDistributionPermission(
  userDoc: any,
  companyId?: string
) {
  if (!userDoc?.memberships || !Array.isArray(userDoc.memberships))
    return false;

  if (companyId) {
    const match = userDoc.memberships.find(
      (m: any) => String(m.companyId) === String(companyId)
    );
    return hasMembershipPermission(match);
  }

  // No companyId passed → allow if any membership grants permission
  return userDoc.memberships.some((m: any) => hasMembershipPermission(m));
}
export function userHasUploadPermission(userDoc: any, companyId?: string) {
  if (!userDoc?.memberships || !Array.isArray(userDoc.memberships))
    return false;
  const has = (m: any) =>
    m?.role === "superadmin" || m?.role === "admin" || !!m?.canUploadLeads;

  if (companyId) {
    const m = userDoc.memberships.find(
      (x: any) => String(x.companyId) === String(companyId)
    );
    return has(m);
  }
  return userDoc.memberships.some(has);
}
