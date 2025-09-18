// apps/web/src/app/dashboard/my-leads/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import MyLeadsClient from "./MyLeadsClient";

// ✅ make sure this page is never prerendered
export const dynamic = "force-dynamic";

type Caps = {
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
};

type Role =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | string;

type AppSession = {
  user?: { name?: string | null } | null;
  userId?: string;
  role?: Role;
  caps?: Partial<Caps>;
  activeCompanyCode?: string | null;
  activeCompanyId?: string | null;
};

export default async function EmployeeLeadsPage() {
  const sessionRaw = await getServerSession(authOptions);

  // match your NextAuth pages.signIn = "/sign-in"
  if (!sessionRaw) redirect("/sign-in");

  const session = sessionRaw as AppSession;

  const role: string | undefined = session.role;
  const caps: Record<string, boolean> = (session.caps ?? {}) as Record<
    string,
    boolean
  >;
  const userId: string | undefined = session.userId;
  const name = session.user?.name || "";

  const companyCode = session.activeCompanyCode?.toLowerCase();

  const isAllowed =
    role === "lead_operator" && (companyCode === "b" || companyCode === "c");
  if (!isAllowed) redirect("/");

  const activeCompanyId: string | undefined =
    session.activeCompanyId ?? undefined;

  return (
    <MyLeadsClient
      userId={userId!}
      name={name}
      role={role!}
      caps={caps}
      activeCompanyId={activeCompanyId}
    />
  );
}
