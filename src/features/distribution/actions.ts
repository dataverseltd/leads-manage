// ./src/features/distribution/actions.ts
export type ToggleResponseBase = {
  ok?: boolean;
  switched?: "on" | "off";
  drained?: number;
  workingDay?: string;
  error?: string;
};

// Allow extra server fields, but type them safely:
export type ToggleResponse = ToggleResponseBase & Record<string, unknown>;

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

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? (data as { error?: string }).error
        : undefined) || "Failed to toggle distribution";
    throw new Error(msg);
  }

  // If the parsed JSON isn't an object, coerce to a minimal shape
  const obj =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  return obj as ToggleResponse;
}
