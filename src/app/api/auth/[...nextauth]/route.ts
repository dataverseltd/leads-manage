// apps/web/src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Company from "@/models/Company";

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

// -----------------------------
// Helpers
// -----------------------------

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

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds, req) => {
        await connectDB();

        const email = String(creds?.email || "")
          .toLowerCase()
          .trim();
        const password = String(creds?.password || "");
        if (!email || !password) return null;

        // Need full doc to save login history
        const user: any = await User.findOne({ email }).lean(false);
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const ipHeader = (req?.headers as any)?.["x-forwarded-for"] as
          | string
          | undefined;
        const ip = ipHeader?.split(",")[0]?.trim() || "unknown";
        const ua =
          ((req?.headers as any)?.["user-agent"] as string | undefined) ??
          "unknown";

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
        } as any;
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
      if (user) {
        token.userId = (user as any).id;
        token.sessionToken = (user as any).sessionToken;
      }

      // Allow switching active company from client:
      // await session.update({ activeCompanyId })
      if (trigger === "update" && session && (session as any).activeCompanyId) {
        (token as any).activeCompanyId = (session as any).activeCompanyId;
      }

      if (!token.userId) return token;

      await connectDB();

      // Pull user + memberships (lean for perf)
      const dbUser: any = await User.findById(token.userId)
        .select("memberships")
        .lean();

      const rawMemberships = Array.isArray(dbUser?.memberships)
        ? (dbUser.memberships as MembershipDoc[])
        : [];

      // Preload all companies for these memberships
      const companyIds = rawMemberships
        .map((m: any) => m.companyId)
        .filter(Boolean);
      const companies = companyIds.length
        ? await Company.find({ _id: { $in: companyIds } })
            .select("_id code roleMode active")
            .lean()
        : [];

      const companyMap = new Map<
        string,
        { roleMode: RoleMode; code?: string; active?: boolean }
      >();
      for (const c of companies) {
        companyMap.set(String(c._id), {
          roleMode: ((c as any).roleMode as RoleMode) || "hybrid",
          code: c.code,
          active: c.active,
        });
      }

      // Build memberships with *effective* caps

      const memberships: MembershipView[] = rawMemberships.map((m) => {
        const cid = String(m.companyId);
        const comp = companyMap.get(cid);
        const mode: RoleMode = (comp?.roleMode as RoleMode) || "hybrid";

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

      (token as any).memberships = memberships;

      // Determine active company
      let activeCompanyId: string | undefined = (token as any).activeCompanyId;
      if (!activeCompanyId) {
        if (memberships.length === 1) {
          activeCompanyId = memberships[0].companyId;
        } else {
          activeCompanyId =
            memberships.find((m) => m.active)?.companyId ||
            memberships[0]?.companyId;
        }
      }
      (token as any).activeCompanyId = activeCompanyId;

      // Compute token-level caps/role data from the active membership
      const active = memberships.find((m) => m.companyId === activeCompanyId);
      if (active) {
        // Use membership role as the primary "role"
        token.role = active.role;
        (token as any).activeCompanyCode = active.companyCode || null;
        (token as any).roleMode = active.roleMode || "hybrid";
        (token as any).caps = {
          canUploadLeads: active.canUploadLeads,
          canReceiveLeads: active.canReceiveLeads,
          can_distribute_leads: active.can_distribute_leads,
          can_distribute_fbids: active.can_distribute_fbids,
          can_create_user: active.can_create_user,
        };
      } else {
        // Fallback (no memberships)
        token.role = undefined;
        (token as any).activeCompanyCode = null;
        (token as any).roleMode = "hybrid";
        (token as any).caps = {
          canUploadLeads: false,
          canReceiveLeads: false,
          can_distribute_leads: false,
          can_distribute_fbids: false,
          can_create_user: false,
        };
      }

      return token;
    },

    /**
     * Session callback:
     * Mirrors JWT data into the session for client usage
     */
    async session({ session, token }) {
      (session as any).userId = token.userId;
      (session as any).role = token.role;
      (session as any).caps = (token as any).caps || {};
      (session as any).sessionToken = (token as any).sessionToken;

      (session as any).memberships = (token as any).memberships || [];
      (session as any).activeCompanyId = (token as any).activeCompanyId || null;
      (session as any).activeCompanyCode =
        (token as any).activeCompanyCode || null;
      (session as any).roleMode = (token as any).roleMode || "hybrid";

      return session;
    },
  },

  pages: {
    signIn: "/sign-in",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
