// apps/web/src/features/distribution/actions.ts

export type PauseReason =
  | "no_receivers"
  | "no_eligible_receivers"
  | "daily_cap_reached"
  | "max_concurrent_reached";

export type ToggleResponse = {
  ok: boolean;
  switched: "on" | "off";
  workingDay: string;

  drained?: number;

  // ✅ new fields from assignBatch
  paused?: boolean;
  reason?: PauseReason;

  // error field may appear in some server cases
  error?: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function pickNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function pickBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function parseToggleResponse(data: unknown): ToggleResponse {
  const o = isObject(data) ? data : {};

  // hard-required fields (with safe fallbacks)
  const ok = pickBool(o.ok) ?? true;
  const switched = (pickString(o.switched) as "on" | "off") ?? "off";
  const workingDay = pickString(o.workingDay) ?? "";

  const paused = pickBool(o.paused);
  const reason = pickString(o.reason) as PauseReason | undefined;

  const drained = pickNumber(o.drained);
  const error = pickString(o.error);

  return { ok, switched, workingDay, drained, paused, reason, error };
}

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

  let data: unknown = undefined;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const msg =
      (isObject(data) && pickString(data.error)) ||
      "Failed to toggle distribution";
    throw new Error(msg);
  }

  return parseToggleResponse(data);
}
