// apps/web/src/app/dashboard/my-leads/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import MyLeadsClient from "./MyLeadsClient";

// ✅ make sure this page is never prerendered
// apps/web/src/app/dashboard/my-leads/page.tsx
export const dynamic = "force-dynamic";

export default async function EmployeeLeadsPage() {
  const session = await getServerSession(authOptions);

  // match your NextAuth pages.signIn = "/sign-in"
  if (!session) redirect("/sign-in");

  const role = (session as any)?.role as string | undefined;
  const caps = ((session as any)?.caps || {}) as Record<string, boolean>;
  const userId = (session as any)?.userId as string | undefined;
  const name = session.user?.name || "";

  // this will be undefined until you add it in NextAuth (see Fix #2)
  const companyCode = (session as any)?.activeCompanyCode?.toLowerCase();

  const isAllowed =
    role === "lead_operator" && (companyCode === "b" || companyCode === "c");
  if (!isAllowed) redirect("/");

  const activeCompanyId = (session as any)?.activeCompanyId as
    | string
    | undefined;

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
