import "next-auth";

declare module "next-auth" {
  interface Session {
    userId?: string;
    role?:
      | "superadmin"
      | "admin"
      | "lead_operator"
      | "fb_submitter"
      | "fb_analytics_viewer";
    caps?: {
      canUploadLeads?: boolean;
      canReceiveLeads?: boolean;
      can_distribute_leads?: boolean;
      can_distribute_fbids?: boolean;
      can_create_user?: boolean;
    };
    activeCompanyId?: string;
    sessionToken?: string;
  }
}
