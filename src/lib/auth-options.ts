// src/lib/auth-options.ts
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
  role: MembershipDoc["role"];
  roleMode: RoleMode;
  active: boolean;

  // raw caps from DB
  canUploadLeads_raw: boolean;
  canReceiveLeads_raw: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;

  // effective caps after company policy
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
}

// --- add name to the lean type ---
type CompanyLean = {
  _id: Types.ObjectId;
  name?: string; // <-- NEW
  code?: string;
  roleMode?: RoleMode;
  active?: boolean;
};

// --- add companyName to the membership view returned to client ---
interface MembershipView {
  companyId: string;
  companyCode?: string;
  companyName?: string; // <-- NEW
  role: MembershipDoc["role"];
  roleMode: RoleMode;
  active: boolean;

  // raw caps from DB
  canUploadLeads_raw: boolean;
  canReceiveLeads_raw: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;

  // effective caps after company policy
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
}

/** Augment JWT token shape we store */
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

/** Session we expose to client */
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

/** User doc used in authorize() (non-lean so we can .save()) */
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

/** User shape used in jwt callback (lean) */
type UserLeanForJwt = {
  _id: Types.ObjectId;
  memberships?: MembershipDoc[];
};

/* ---------------- Helpers ---------------- */

function applyCompanyModeCaps(
  m: { canUploadLeads: boolean; canReceiveLeads: boolean },
  mode: RoleMode
) {
  // Company policy gates the user's membership caps
  const allows = {
    uploadLeads: mode !== "receiver", // uploader/hybrid => true
    receiveLeads: mode !== "uploader", // receiver/hybrid => true
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

  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      // In NextAuth v4, `request` is RequestInternal; we only need headers.
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

        // Need full doc (non-lean) to save login history
        const user = (await User.findOne({ email }).exec()) as
          | (UserDocForAuthorize & Record<string, unknown>)
          | null;
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const ipHeader = headerString(request?.headers, "x-forwarded-for");
        const ip = ipHeader?.split(",")[0]?.trim() || "unknown";
        const ua = headerString(request?.headers, "user-agent") ?? "unknown";

        const sessionToken =
          typeof crypto?.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        try {
          user.currentSessionToken = sessionToken;
          user.isLoggedIn = true;
          user.lastLoginAt = new Date();
          user.lastKnownIP = ip;
          user.lastUserAgent = ua;
          user.loginHistory = user.loginHistory || [];
          user.loginHistory.push({ ip, userAgent: ua, loggedInAt: new Date() });
          await user.save();
        } catch {
          // ignore non-critical save failures
        }

        // Minimal user payload; rest will be hydrated in jwt callback
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
    /**
     * JWT callback:
     * - Hydrates memberships from DB
     * - Fetches company roleMode for each membership
     * - Intersects membership caps with company policy
     * - Chooses activeCompanyId (persisted, or single membership, or first active)
     * - Exposes caps, roleMode, activeCompanyCode on token
     * - Supports client-side company switch via session.update({ activeCompanyId })
     */
    async jwt({ token, user, trigger, session }) {
      const t = token as AugmentedToken;

      if (user) {
        // `user` is what we returned from authorize()
        const u = user as { id?: string; sessionToken?: string };
        t.userId = u.id;
        t.sessionToken = u.sessionToken;
      }

      // Allow switching active company from client via session.update({ activeCompanyId })
      if (trigger === "update" && session) {
        const s = session as Partial<AppSession>;
        if (s.activeCompanyId) {
          t.activeCompanyId = s.activeCompanyId;
        }
      }

      if (!t.userId) return t;

      await connectDB();

      // Pull user + memberships (lean for perf)
      const dbUser = (await User.findById(t.userId)
        .select("memberships")
        .lean<UserLeanForJwt>()) as UserLeanForJwt | null;

      const rawMemberships: MembershipDoc[] = Array.isArray(dbUser?.memberships)
        ? dbUser!.memberships!
        : [];

      // Preload all companies for these memberships
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
          name: c.name, // <-- store name
          active: c.active,
        });
      }

      // Build memberships with *effective* caps
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
          companyName: comp?.name ?? undefined, // <-- expose name to client
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

      // Determine active company
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

      // Compute token-level caps/role data from the active membership
      const active = memberships.find((m) => m.companyId === activeCompanyId);
      if (active) {
        // Use membership role as the primary "role"
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
        // Fallback (no memberships)
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

    /**
     * Session callback:
     * Mirrors JWT data into the session for client usage
     */
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
