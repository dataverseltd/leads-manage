// apps/web/src/app/dashboard/admin/screenshots/page.tsx
import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import AdminScreenshots from "./AdminScreenshots";
import { authOptions } from "@/lib/auth-options";

type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

type CustomSession = Session & {
  role?: Role | string | null;
  activeCompanyId?: string | null;
  user?: Session["user"] & {
    role?: Role | string | null;
    activeCompanyId?: string | null;
  };
};

function getRole(session: CustomSession | null): string {
  if (!session) return "";
  return (session.role ?? session.user?.role ?? "") || "";
}

function getActiveCompanyId(session: CustomSession | null): string {
  if (!session) return "";
  return (session.activeCompanyId ?? session.user?.activeCompanyId ?? "") || "";
}

export default async function Page() {
  const session = (await getServerSession(authOptions)) as CustomSession | null;

  // Basic guard: superadmin/admin only
  const role = getRole(session);
  if (!role || !["superadmin", "admin"].includes(role)) {
    redirect("/dashboard"); // or render a 403 component
  }

  const companyId = getActiveCompanyId(session);

  return <AdminScreenshots companyId={companyId} />;
}
