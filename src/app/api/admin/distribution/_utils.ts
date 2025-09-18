import { NextRequest } from "next/server";
import mongoose, { Types } from "mongoose";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

/* ---------------- Types ---------------- */

type AppSession = Session & {
  userId?: string; // if you attach this in NextAuth callbacks
  role?: string;
  activeCompanyId?: string;
};

type Membership = {
  companyId?: Types.ObjectId;
  role?: "superadmin" | "admin" | "employee" | string;
  can_distribute_leads?: boolean;
  canUploadLeads?: boolean;
};

type UserLean = {
  _id: Types.ObjectId;
  email?: string | null;
  memberships?: Membership[];
};

type GetUserForSessionResult =
  | { session: AppSession; userDoc: UserLean }
  | { session: AppSession | null; userDoc: null }
  | { session: null; userDoc: null };

/* -------------- Helpers --------------- */

export function getCompanyIdFromReq(req: NextRequest): string | undefined {
  const url = new URL(req.url);
  return (
    url.searchParams.get("companyId") ??
    req.headers.get("x-company-id") ??
    undefined
  );
}

function hasMembershipPermission(m?: Membership): boolean {
  if (!m) return false;
  const isAdmin = m.role === "superadmin" || m.role === "admin";
  const canDistribute = !!m.can_distribute_leads;
  return isAdmin || canDistribute;
}

/**
 * Look up the current session and its user (by id or email).
 * Returns `{ session: null, userDoc: null }` if no session.
 */
export async function getUserForSession(): Promise<GetUserForSessionResult> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user) return { session: null, userDoc: null };

  // Prefer custom `session.userId` if you set it in callbacks, then fallback to typical NextAuth fields.
  const explicitUserId = session.userId;
  const embeddedId =
    (session.user as unknown as { _id?: string; id?: string })?._id ??
    (session.user as unknown as { _id?: string; id?: string })?.id ??
    null;
  const id = explicitUserId ?? embeddedId ?? null;
  const email = session.user.email ?? null;

  await connectDB();

  let userDoc: UserLean | null = null;
  if (id && mongoose.isValidObjectId(id)) {
    userDoc = await User.findById(id).lean<UserLean>();
  }
  if (!userDoc && email) {
    userDoc = await User.findOne({ email }).lean<UserLean>();
  }

  if (userDoc) {
    return { session: session as AppSession, userDoc };
  }
  return { session: session as AppSession, userDoc: null };
}

/**
 * Returns true if the user has distribution permission.
 * - If companyId provided: check that specific membership.
 * - If companyId not provided: allow if ANY membership grants permission.
 */
export function userHasDistributionPermission(
  userDoc: UserLean | null | undefined,
  companyId?: string
): boolean {
  const memberships = Array.isArray(userDoc?.memberships)
    ? (userDoc!.memberships as Membership[])
    : [];

  if (!memberships.length) return false;

  if (companyId) {
    const match = memberships.find(
      (m) => String(m.companyId) === String(companyId)
    );
    return hasMembershipPermission(match);
  }

  // No companyId passed → allow if any membership grants permission
  return memberships.some((m) => hasMembershipPermission(m));
}

/**
 * Returns true if the user can upload leads.
 * Admins and superadmins are always allowed; otherwise require `canUploadLeads`.
 */
export function userHasUploadPermission(
  userDoc: UserLean | null | undefined,
  companyId?: string
): boolean {
  const memberships = Array.isArray(userDoc?.memberships)
    ? (userDoc!.memberships as Membership[])
    : [];

  if (!memberships.length) return false;

  const check = (m?: Membership): boolean => {
    if (!m) return false;
    return m.role === "superadmin" || m.role === "admin" || !!m.canUploadLeads;
    // If you instead gate by company roleMode, do that at the callsite.
  };

  if (companyId) {
    const m = memberships.find(
      (x) => String(x.companyId) === String(companyId)
    );
    return check(m);
  }

  return memberships.some((m) => check(m));
}
