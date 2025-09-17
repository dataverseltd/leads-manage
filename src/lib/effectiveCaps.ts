// src/lib/effectiveCaps.ts
import Company from "@/models/Company";

type RoleMode = "uploader" | "receiver" | "hybrid";

type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | (string & {}); // allow future roles as string

type Membership = {
  companyId: unknown; // may be string or ObjectId-like; we'll normalize safely
  role?: Role | null;
  canUploadLeads?: boolean;
  canReceiveLeads?: boolean;
  can_distribute_leads?: boolean;
  can_distribute_fbids?: boolean;
  can_create_user?: boolean;
};

type UserWithMemberships = {
  memberships?: Membership[] | null;
};

type EffectiveCaps = {
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
  role: Role | null;
  roleMode: RoleMode;
};

// helper to safely stringify possible ObjectId/string
function asIdString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "_id" in v) {
    const id = (v as { _id?: unknown })._id;
    return typeof id === "string" ? id : String(id ?? "");
  }
  return String(v ?? "");
}

export async function getEffectiveCaps({
  user,
  activeCompanyId,
}: {
  user: UserWithMemberships;
  activeCompanyId: string;
}): Promise<EffectiveCaps> {
  const membership =
    user?.memberships?.find(
      (m) => asIdString(m.companyId) === String(activeCompanyId)
    ) ?? null;

  // Only need roleMode; lean for perf + light typing
  const company = await Company.findById(activeCompanyId)
    .lean<{ roleMode?: RoleMode }>()
    .exec();

  const mode: RoleMode = company?.roleMode ?? "hybrid";

  const companyAllows = {
    uploadLeads: mode !== "receiver", // uploader/hybrid => true
    receiveLeads: mode !== "uploader", // receiver/hybrid => true
  };

  const userCaps = {
    canUploadLeads: !!membership?.canUploadLeads,
    canReceiveLeads: !!membership?.canReceiveLeads,
    can_distribute_leads: !!membership?.can_distribute_leads,
    can_distribute_fbids: !!membership?.can_distribute_fbids,
    can_create_user: !!membership?.can_create_user,
    role: (membership?.role ?? null) as Role | null,
  };

  return {
    ...userCaps,
    canUploadLeads: userCaps.canUploadLeads && companyAllows.uploadLeads,
    canReceiveLeads: userCaps.canReceiveLeads && companyAllows.receiveLeads,
    roleMode: mode,
  };
}
