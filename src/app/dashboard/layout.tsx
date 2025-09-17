import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AppShell from "@/components/AppShell";

// helper: pick membership for the active company (adjust to your session shape)
function capsFromMembership(m: any) {
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
  const session = await getServerSession(authOptions);

  // Pull the correct membership for the user (however you already do this)
  const membership = (session as any)?.activeMembership || null;
  const role = membership?.role || (session as any)?.role || "";
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
