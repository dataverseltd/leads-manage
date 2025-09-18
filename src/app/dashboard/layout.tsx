// ./src/app/dashboard/layout.tsx
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import AppShell from "@/components/AppShell";

type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

type CustomSession = Session & {
  role?: Role;
  caps?: {
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
    can_distribute_leads: boolean;
    can_distribute_fbids: boolean;
    can_create_user: boolean;
  };
  memberships?: Array<{
    companyId: string;
    companyCode?: string | null;
    companyName?: string | null; // <-- now present from auth-options
    role: string;
    roleMode: "uploader" | "receiver" | "hybrid";
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
    can_distribute_leads: boolean;
    can_distribute_fbids: boolean;
    can_create_user: boolean;
    active: boolean;
  }>;
  activeCompanyId?: string | null;
};

function capsFromActive(session: CustomSession | null) {
  const active = session?.memberships?.find(
    (m) => m.companyId === session?.activeCompanyId
  );
  return {
    canUploadLeads: !!active?.canUploadLeads,
    canReceiveLeads: !!active?.canReceiveLeads,
    can_distribute_leads: !!active?.can_distribute_leads,
    can_distribute_fbids: !!active?.can_distribute_fbids,
    can_create_user: !!active?.can_create_user,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;

  const roleRaw: Role = (session?.role ?? "") as Role;
  // normalize employee -> lead_operator if needed in your AppShell
  const role = roleRaw === "employee" ? ("lead_operator" as const) : roleRaw;

  const caps = capsFromActive(session);

  const user = {
    name: session?.user?.name ?? "User",
    role,
  };

  const memberships =
    session?.memberships?.map((m) => ({
      companyId: m.companyId,
      companyName: m.companyName ?? "Company", // <-- comes from DB now
      roleMode: m.roleMode,
      isPrimary: m.companyId === session?.activeCompanyId,
    })) ?? [];

  return (
    <AppShell
      user={user}
      role={role}
      caps={caps}
      myLeadsBadge={12}
      memberships={memberships}
    >
      <div className="mx-auto container py-10">{children}</div>
    </AppShell>
  );
}
