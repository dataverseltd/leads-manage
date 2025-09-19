import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";

const page = async () => {
  const session = await getServerSession(authOptions);

  console.log(session, "home");
  if (!session) {
    redirect("/sign-in");
  } else if (
    session.role === "superadmin" ||
    session.role === "admin" ||
    session.roleMode === "receiver"
  ) {
    redirect("/dashboard/admin/distribution");
  } else if (session.role === "lead_operator" || session.caps?.canUploadLeads) {
    redirect("/dashboard/leads/upload");
  } else if (session.caps?.canReceiveLeads) {
    redirect("/dashboard/my-leads");
  }
  // redirect("/dashboard/signup-summary");
};

export default page;
