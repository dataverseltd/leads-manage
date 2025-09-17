export type ToggleResponse = {
  ok?: boolean;
  switched?: "on" | "off";
  drained?: number;
  workingDay?: string;
  [key: string]: any;
};

export async function toggleTodayDistribution(
  active: boolean,
  companyId?: string
): Promise<ToggleResponse> {
  const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const res = await fetch(`/api/admin/distribution/today/toggle${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ active }), // server expects { active }
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || "Failed to toggle distribution");
  }
  return data as ToggleResponse;
}
