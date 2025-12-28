import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import MyLeadsClient from "./MyLeadsClient";

export const dynamic = "force-dynamic";

type RoleMode = "uploader" | "receiver" | "hybrid";

type Caps = {
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
};

type AppSession = {
  user?: { name?: string | null } | null;
  userId?: string;
  role?: string;
  caps?: Partial<Caps>;
  activeCompanyId?: string | null;
  activeCompanyCode?: string | null;
  roleMode?: RoleMode;
};

export default async function EmployeeLeadsPage() {
  const sessionRaw = await getServerSession(authOptions);
  if (!sessionRaw) redirect("/sign-in");

  const session = sessionRaw as AppSession;

  const role = session.role;
  const roleMode = session.roleMode ?? "hybrid";
  const userId = session.userId;
  const name = session.user?.name || "";

  const activeCompanyId = session.activeCompanyId ?? undefined;
  const caps = (session.caps ?? {}) as Record<string, boolean>;

  // must have an active company selected
  if (!activeCompanyId) redirect("/");

  // ✅ ACCESS RULE: lead_operator + company is receiver-mode (or hybrid)
  const isAllowed =
    role === "lead_operator" &&
    (roleMode === "receiver" || roleMode === "hybrid");

  if (!isAllowed) redirect("/");

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
