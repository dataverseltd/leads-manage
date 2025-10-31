import type { NextAuthOptions, DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { RequestInternal } from "next-auth";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Company from "@/models/Company";

/* ---------------- Types ---------------- */

type RoleMode = "uploader" | "receiver" | "hybrid";

interface MembershipDoc {
  companyId: string;
  role:
    | "superadmin"
    | "admin"
    | "lead_operator"
    | "fb_submitter"
    | "fb_analytics_viewer";
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
}

interface MembershipView {
  companyId: string;
  companyCode?: string;
  companyName?: string;
  role: MembershipDoc["role"];
  roleMode: RoleMode;
  active: boolean;

  canUploadLeads_raw: boolean;
  canReceiveLeads_raw: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;

  canUploadLeads: boolean;
  canReceiveLeads: boolean;
}

type CompanyLean = {
  _id: Types.ObjectId;
  name?: string;
  code?: string;
  roleMode?: RoleMode;
  active?: boolean;
};

type AugmentedToken = JWT & {
  userId?: string;
  sessionToken?: string;
  memberships?: MembershipView[];
  activeCompanyId?: string;
  activeCompanyCode?: string | null;
  roleMode?: RoleMode;
  role?: MembershipDoc["role"];
  caps?: {
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
    can_distribute_leads: boolean;
    can_distribute_fbids: boolean;
    can_create_user: boolean;
  };
};

type AppSession = DefaultSession & {
  userId?: string;
  role?: MembershipDoc["role"];
  caps?: AugmentedToken["caps"];
  sessionToken?: string;
  memberships?: MembershipView[];
  activeCompanyId?: string | null;
  activeCompanyCode?: string | null;
  roleMode?: RoleMode;
};

type UserDocForAuthorize = {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  passwordHash?: string;
  currentSessionToken?: string;
  isLoggedIn?: boolean;
  lastLoginAt?: Date;
  lastKnownIP?: string;
  lastUserAgent?: string;
  loginHistory: Array<{ ip: string; userAgent: string; loggedInAt: Date }>;
  save: () => Promise<unknown>;
};

type UserLeanForJwt = {
  _id: Types.ObjectId;
  memberships?: MembershipDoc[];
};

/* ---------------- Helpers ---------------- */

function applyCompanyModeCaps(
  m: { canUploadLeads: boolean; canReceiveLeads: boolean },
  mode: RoleMode
) {
  const allows = {
    uploadLeads: mode !== "receiver",
    receiveLeads: mode !== "uploader",
  };
  return {
    canUploadLeads: m.canUploadLeads && allows.uploadLeads,
    canReceiveLeads: m.canReceiveLeads && allows.receiveLeads,
  };
}

function headerString(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const v = headers?.[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

/* ---------------- NextAuth ---------------- */

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  // ✅ Fix: disable JWT encryption so magic-link JWTs are read properly

  // ✅ JWT configuration (no encryption flag needed in NextAuth v4+)
  jwt: {
    maxAge: 12 * 60 * 60, // optional: 12 hours same as your link expiry
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (
        creds,
        request: Pick<RequestInternal, "headers"> & Partial<RequestInternal>
      ) => {
        await connectDB();

        const email = String(creds?.email || "")
          .toLowerCase()
          .trim();
        const password = String(creds?.password || "");
        if (!email || !password) return null;

        const user = await User.findOne({ email }).exec();

        // type guard for null or wrong shape
        if (!user || typeof user !== "object" || !("memberships" in user)) {
          return null;
        }

        const typedUser = user as UserDocForAuthorize & {
          memberships?: MembershipDoc[];
        };

        if (!typedUser.passwordHash) return null;

        // ✅ Only allow password login for admins/superadmins
        const roles = (typedUser.memberships || []).map((m) => m.role);

        const isAdmin = roles.includes("admin") || roles.includes("superadmin");

        if (!isAdmin) {
          throw new Error("Secure link login required for this account.");
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const ipHeader = headerString(request?.headers, "x-forwarded-for");
        const ip = ipHeader?.split(",")[0]?.trim() || "unknown";
        const ua = headerString(request?.headers, "user-agent") ?? "unknown";

        const sessionToken =
          typeof crypto?.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        user.currentSessionToken = sessionToken;
        user.isLoggedIn = true;
        user.lastLoginAt = new Date();
        user.lastKnownIP = ip;
        user.lastUserAgent = ua;
        user.loginHistory = user.loginHistory || [];
        user.loginHistory.push({ ip, userAgent: ua, loggedInAt: new Date() });
        await user.save();

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          sessionToken,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as AugmentedToken;

      if (user) {
        const u = user as { id?: string; sessionToken?: string };
        t.userId = u.id;
        t.sessionToken = u.sessionToken;
      }

      if (trigger === "update" && session) {
        const s = session as Partial<AppSession>;
        if (s.activeCompanyId) t.activeCompanyId = s.activeCompanyId;
      }

      if (!t.userId) return t;

      await connectDB();

      const dbUser = (await User.findById(t.userId)
        .select("memberships")
        .lean<UserLeanForJwt>()) as UserLeanForJwt | null;

      const rawMemberships: MembershipDoc[] = Array.isArray(dbUser?.memberships)
        ? dbUser!.memberships!
        : [];

      const companyIds = rawMemberships
        .map((m) => m.companyId)
        .filter((cid): cid is string => Boolean(cid));

      const companies: CompanyLean[] = companyIds.length
        ? await Company.find({ _id: { $in: companyIds } })
            .select("_id name code roleMode active")
            .lean<CompanyLean[]>()
        : [];

      const companyMap = new Map<
        string,
        { roleMode: RoleMode; code?: string; name?: string; active?: boolean }
      >();

      for (const c of companies) {
        companyMap.set(String(c._id), {
          roleMode: c.roleMode ?? "hybrid",
          code: c.code,
          name: c.name,
          active: c.active,
        });
      }

      const memberships: MembershipView[] = rawMemberships.map((m) => {
        const cid = String(m.companyId);
        const comp = companyMap.get(cid);
        const mode: RoleMode = comp?.roleMode ?? "hybrid";

        const intersect = applyCompanyModeCaps(
          {
            canUploadLeads: !!m.canUploadLeads,
            canReceiveLeads: !!m.canReceiveLeads,
          },
          mode
        );

        return {
          companyId: cid,
          companyCode: comp?.code ? String(comp.code).toLowerCase() : undefined,
          companyName: comp?.name ?? undefined,
          role: m.role,
          roleMode: mode,
          active: comp?.active ?? true,
          canUploadLeads_raw: !!m.canUploadLeads,
          canReceiveLeads_raw: !!m.canReceiveLeads,
          can_distribute_leads: !!m.can_distribute_leads,
          can_distribute_fbids: !!m.can_distribute_fbids,
          can_create_user: !!m.can_create_user,
          canUploadLeads: intersect.canUploadLeads,
          canReceiveLeads: intersect.canReceiveLeads,
        };
      });

      t.memberships = memberships;

      let activeCompanyId: string | undefined = t.activeCompanyId;
      if (!activeCompanyId) {
        if (memberships.length === 1) {
          activeCompanyId = memberships[0].companyId;
        } else {
          activeCompanyId =
            memberships.find((m) => m.active)?.companyId ||
            memberships[0]?.companyId;
        }
      }
      t.activeCompanyId = activeCompanyId;

      const active = memberships.find((m) => m.companyId === activeCompanyId);
      if (active) {
        t.role = active.role;
        t.activeCompanyCode = active.companyCode || null;
        t.roleMode = active.roleMode || "hybrid";
        t.caps = {
          canUploadLeads: active.canUploadLeads,
          canReceiveLeads: active.canReceiveLeads,
          can_distribute_leads: active.can_distribute_leads,
          can_distribute_fbids: active.can_distribute_fbids,
          can_create_user: active.can_create_user,
        };
      } else {
        t.role = undefined;
        t.activeCompanyCode = null;
        t.roleMode = "hybrid";
        t.caps = {
          canUploadLeads: false,
          canReceiveLeads: false,
          can_distribute_leads: false,
          can_distribute_fbids: false,
          can_create_user: false,
        };
      }

      return t;
    },

    async session({ session, token }) {
      const t = token as AugmentedToken;
      const s = session as AppSession;

      s.userId = t.userId;
      s.role = t.role;
      s.caps = t.caps ?? {
        canUploadLeads: false,
        canReceiveLeads: false,
        can_distribute_leads: false,
        can_distribute_fbids: false,
        can_create_user: false,
      };
      s.sessionToken = t.sessionToken;
      s.memberships = t.memberships ?? [];
      s.activeCompanyId = t.activeCompanyId ?? null;
      s.activeCompanyCode = t.activeCompanyCode ?? null;
      s.roleMode = t.roleMode ?? "hybrid";

      return s;
    },
  },

  pages: {
    signIn: "/sign-in",
  },
};
