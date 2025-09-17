// ./src/app/dashboard/layout.tsx
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AppShell from "@/components/AppShell";

type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

// If you've augmented NextAuth types globally, you can import them instead.
// For local safety (no `any`), define a narrow session shape here:
type Membership = {
  companyId: string;
  role: Role;
  // In your app, caps appear to live directly on the membership object
  canUploadLeads?: boolean;
  canReceiveLeads?: boolean;
  can_distribute_leads?: boolean;
  can_distribute_fbids?: boolean;
  can_create_user?: boolean;
} | null;

type CustomSession = Session & {
  role?: Role;
  activeMembership?: Membership;
};

type Caps = {
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
};

// helper: pick membership caps for the active company (typed)
function capsFromMembership(m?: Membership): Caps {
  return {
    canUploadLeads: !!m?.canUploadLeads,
    canReceiveLeads: !!m?.canReceiveLeads,
    can_distribute_leads: !!m?.can_distribute_leads,
    can_distribute_fbids: !!m?.can_distribute_fbids,
    can_create_user: !!m?.can_create_user,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;

  // Pull the correct membership for the user (however you already do this)
  const membership = session?.activeMembership ?? null;
  const role: Role = membership?.role ?? session?.role ?? "";

  const caps = capsFromMembership(membership);

  const user = {
    name: session?.user?.name ?? "User",
    role,
  };

  return (
    <AppShell user={user} role={role} caps={caps} myLeadsBadge={12}>
      <div className="mx-auto container py-10">{children}</div>
    </AppShell>
  );
}
