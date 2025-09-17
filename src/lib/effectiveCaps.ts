// src/lib/effectiveCaps.ts
import Company from "@/models/Company";

export async function getEffectiveCaps({
  user,
  activeCompanyId,
}: {
  user: any;
  activeCompanyId: string;
}) {
  const membership =
    user?.memberships?.find(
      (m: any) => String(m.companyId) === String(activeCompanyId)
    ) || null;

  const company = await Company.findById(activeCompanyId).lean();
  const mode = company?.roleMode || "hybrid";

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
    role: membership?.role || null,
  };

  // intersect company policy with user caps
  return {
    ...userCaps,
    canUploadLeads: userCaps.canUploadLeads && companyAllows.uploadLeads,
    canReceiveLeads: userCaps.canReceiveLeads && companyAllows.receiveLeads,
    roleMode: mode,
  };
}
