"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  Play,
  Pause,
  RefreshCw,
  Users2,
  Clock4,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter,
  Lock,
} from "lucide-react";
import { toggleTodayDistribution } from "@/features/distribution/actions";

/* ------------ Types from server payloads / session ------------ */

type Company = {
  _id: string;
  name: string;
  roleMode?: "uploader" | "receiver" | "hybrid";
  code?: string;
};

type Receiver = {
  _id: string;
  name: string;
  employeeId?: string;
  role?: string;
  canReceiveLeads?: boolean;
  canUploadLeads?: boolean;
  lastReceivedAt?: string | null;
  distributionWeight?: number;
  maxConcurrentLeads?: number;
  dailyCap?: number; // 0 = unlimited
};

type AssignedRow = {
  receiverId: string;
  name: string;
  employeeId: string;
  count: number;
};

type TodayPayload = {
  ok: boolean;
  workingDay: string;
  switch: {
    isActive: boolean;
    activatedAt?: string | null;
    updatedAt?: string | null;
  };
  metrics: {
    pendingToday: number;
    assignedToday: number; // <-- NEW
    assignedTodayByReceiver: AssignedRow[];
  };
  receivers: Receiver[];
  companyMode?: "uploader" | "receiver" | "hybrid";
};

type ErrorPayload = { error: string };

const isErrorPayload = (v: unknown): v is ErrorPayload =>
  typeof v === "object" && v !== null && "error" in v;

type Membership = {
  companyId?: string;
  role?:
    | "superadmin"
    | "admin"
    | "lead_operator"
    | "fb_submitter"
    | "fb_analytics_viewer"
    | "employee"
    | string;
  can_distribute_leads?: boolean;
  roleMode?: "uploader" | "receiver" | "hybrid";
};

type AppSession = {
  role?: string;
  memberships?: Membership[];
};

/* ------------ Component ------------ */

export default function DistributionAdminPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data } = useSession();
  const session = (data ?? {}) as AppSession;

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>(
    params.get("companyId") || ""
  );

  const [workingDay, setWorkingDay] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [pendingToday, setPendingToday] = useState<number>(0);
  const [assignedRows, setAssignedRows] = useState<AssignedRow[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [serverCompanyMode, setServerCompanyMode] = useState<
    "uploader" | "receiver" | "hybrid" | null
  >(null);
  const [totalAssigned, setTotalAssigned] = useState<number>(0); // <-- NEW

  // filters
  const [q, setQ] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);

  // ---- Permission (UI hints) ----
  const canToggleForCompany = useMemo(() => {
    const memberships = session.memberships ?? [];
    if (!companyId || memberships.length === 0) return true; // optimistic fallback
    const m = memberships.find(
      (mm) => String(mm.companyId) === String(companyId)
    );
    if (!m) return false;
    return (
      m.role === "superadmin" || m.role === "admin" || !!m.can_distribute_leads
    );
  }, [session, companyId]);

  // ---- Effective company mode (priority: server -> session -> list -> infer) ----
  const sessionRoleModeForSelected = useMemo<
    "uploader" | "receiver" | "hybrid" | undefined
  >(() => {
    const memberships = session.memberships ?? [];
    if (!companyId || memberships.length === 0) return undefined;
    const m = memberships.find(
      (mm) => String(mm.companyId) === String(companyId)
    );
    return m?.roleMode;
  }, [session, companyId]);

  const localInferredMode: "uploader" | "receiver" = useMemo(() => {
    if (!receivers.length) return "receiver";
    const anyUpload = receivers.some((r) => r.canUploadLeads);
    const anyReceive = receivers.some((r) => r.canReceiveLeads);
    if (anyUpload && !anyReceive) return "uploader";
    return "receiver";
  }, [receivers]);

  const effectiveCompanyMode = useMemo<
    "uploader" | "receiver" | "hybrid"
  >(() => {
    if (serverCompanyMode) return serverCompanyMode;
    if (sessionRoleModeForSelected) return sessionRoleModeForSelected;
    const fromList = companies.find(
      (c) => String(c._id) === String(companyId)
    )?.roleMode;
    if (fromList) return fromList;
    return localInferredMode;
  }, [
    serverCompanyMode,
    sessionRoleModeForSelected,
    companies,
    companyId,
    localInferredMode,
  ]);

  const pageRestricted = effectiveCompanyMode === "uploader";

  // ---- Data fetchers ----
  async function loadCompanies() {
    const res = await fetch(
      "/api/admin/companies?active=1&need=distribute&scope=memberships",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to load companies");
    const data = (await res.json()) as Company[];
    setCompanies(data);
    if (!companyId && data.length) handleCompanyChange(data[0]._id, false);
  }

  async function refetch() {
    if (!companyId) return;
    try {
      setFetching(true);
      const res = await fetch(
        `/api/admin/distribution/today?companyId=${encodeURIComponent(
          companyId
        )}`,
        { cache: "no-store" }
      );
      const payload = (await res.json()) as TodayPayload | ErrorPayload;
      if (!res.ok) {
        const msg = isErrorPayload(payload) ? payload.error : "Failed to load";
        throw new Error(msg);
      }

      const data = payload as TodayPayload;
      setWorkingDay(data.workingDay);
      setIsActive(Boolean(data.switch?.isActive));
      setActivatedAt(data.switch?.activatedAt || null);
      setPendingToday(Number(data.metrics?.pendingToday || 0));
      setAssignedRows(data.metrics?.assignedTodayByReceiver || []);
      setReceivers(Array.isArray(data.receivers) ? data.receivers : []);
      setServerCompanyMode(data.companyMode ?? null);
      // Prefer server’s authoritative total; fallback to sum if missing
      const serverTotal = Number(data.metrics?.assignedToday ?? NaN);
      if (Number.isFinite(serverTotal)) {
        setTotalAssigned(serverTotal);
      } else {
        const sum = (data.metrics?.assignedTodayByReceiver || []).reduce(
          (acc, r) => acc + (r?.count || 0),
          0
        );
        setTotalAssigned(sum);
      }

      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadCompanies();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companyId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // 🔁 Optional auto-refresh while active (skip if restricted)
  useEffect(() => {
    if (!isActive || !companyId || pageRestricted) return;
    const t = setInterval(() => refetch(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, companyId, pageRestricted]);

  // // ---- Derived ----
  // const totalAssigned = useMemo(
  //   () => assignedRows.reduce((sum, r) => sum + (r?.count || 0), 0),
  //   [assignedRows]
  // );

  const maxAssigned = useMemo(
    () => Math.max(1, ...assignedRows.map((r) => r.count)),
    [assignedRows]
  );

  const assignedMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of assignedRows) map[r.receiverId] = r.count;
    return map;
  }, [assignedRows]);

  const filteredReceivers = useMemo(() => {
    let list = receivers;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(s) ||
          r.employeeId?.toLowerCase().includes(s)
      );
    }
    if (onlyEligible) {
      list =
        effectiveCompanyMode === "uploader"
          ? list.filter((r) => r.canUploadLeads)
          : list.filter((r) => r.canReceiveLeads);
    }
    return list;
  }, [receivers, q, onlyEligible, effectiveCompanyMode]);

  // ---- Actions ----
  const handleCompanyChange = (id: string, push = true) => {
    setCompanyId(id);
    if (push) {
      const sp = new URLSearchParams(Array.from(params.entries()));
      sp.set("companyId", id);
      router.replace(`?${sp.toString()}`);
    }
  };

  const onToggle = async () => {
    if (!companyId) {
      toast.error("Select a company first");
      return;
    }
    if (!canToggleForCompany) {
      toast.error("You don't have permission to control distribution");
      return;
    }
    if (pageRestricted) {
      toast.error(
        "This company is in uploader mode. Distribution control is disabled."
      );
      return;
    }
    const target = !isActive;
    setIsActive(target);
    try {
      const res = await toggleTodayDistribution(target, companyId);
      if (res.switched === "on") {
        toast.success(
          `Distribution started for ${res.workingDay}. Drained ${
            res.drained ?? 0
          } pending.`
        );
        await refetch();
      } else {
        toast.success(`Distribution paused for ${res.workingDay}.`);
      }
    } catch (e: unknown) {
      setIsActive(!target);
      const msg = e instanceof Error ? e.message : "Toggle failed";
      toast.error(msg);
    }
  };

  // PATCH single membership field (optimistic)
  const updateReceiver = async (id: string, patch: Partial<Receiver>) => {
    if (!canToggleForCompany) {
      toast.error("Permission denied");
      return;
    }
    if (pageRestricted) {
      toast.error("This company is in uploader mode. Edits are disabled.");
      return;
    }
    const prev = receivers;
    setReceivers((list) =>
      list.map((r) => (r._id === id ? { ...r, ...patch } : r))
    );
    try {
      const res = await fetch(`/api/admin/receivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, companyId }),
      });
      const payload = (await res.json()) as { ok?: boolean } | ErrorPayload;
      if (!res.ok) {
        const msg = isErrorPayload(payload) ? payload.error : "Update failed";
        throw new Error(msg);
      }
      toast.success("Saved");
    } catch (e: unknown) {
      setReceivers(prev); // revert
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    }
  };

  // ---------------------
  // LOCKED VIEW (uploader-mode company)
  // ---------------------
  if (pageRestricted) {
    return (
      <div className="p-6 md:p-8">
        {/* Header with company switcher */}
        <header className="mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Lead Distribution — For Admin
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  Read-Only
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Working Day: {workingDay || "—"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-400">
                Company
              </label>
              {companies.length > 1 ? (
                <div className="relative">
                  <select
                    value={companyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="appearance-none pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
                  >
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                  {companies[0]?.name || "—"}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Lock notice */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-amber-900 dark:text-amber-100">
                Distribution is disabled
              </h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                The active company is configured as <b>Uploader</b>.
                Auto-distribution controls and receiver eligibility are not
                available. Switch to a company in <b>Receiver</b> or{" "}
                <b>Hybrid</b> mode to manage distribution.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------
  // NORMAL VIEW (receiver/hybrid)
  // ---------------------

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Lead Distribution — For Admin
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 text-xs">
                <ShieldCheck className="h-4 w-4" />
                {canToggleForCompany ? "Can Control" : "Read-Only"}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Working Day: {workingDay || "—"}
            </p>
          </div>

          {/* Company Switcher */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">
              Company
            </label>
            {companies.length > 1 ? (
              <div className="relative">
                <select
                  value={companyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="appearance-none pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
                >
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                {companies[0]?.name || "—"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Status + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 px-3 py-1 text-green-700 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-800 text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    Active today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-3 py-1 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800 text-xs">
                    <Pause className="h-4 w-4" />
                    Paused (pending will accumulate)
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-medium text-gray-900 dark:text-gray-100">
                Control today’s auto-distribution
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {isActive
                  ? "New uploads are being assigned immediately."
                  : "New uploads will be saved as pending until you start."}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Clock4 className="h-4 w-4" />
                <span>
                  {activatedAt
                    ? `Activated at: ${new Date(activatedAt).toLocaleString()}`
                    : "Not activated today"}
                </span>
              </div>
            </div>

            <button
              onClick={onToggle}
              disabled={loading || !companyId || !canToggleForCompany}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 transition ${
                isActive
                  ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 ring-gray-900/10 dark:ring-gray-300 hover:bg-black dark:hover:bg-white"
              } ${!canToggleForCompany ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isActive ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isActive ? "Pause Today" : "Start Today"}
            </button>
          </div>

          {/* Metrics */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              icon={<AlertCircle className="h-5 w-5" />}
              title="Pending Today"
              value={pendingToday}
              sub={
                isActive
                  ? "Assigning as they arrive"
                  : "Will assign when started"
              }
            />
            <MetricCard
              icon={<Users2 className="h-5 w-5" />}
              title="Receivers (visible)"
              value={filteredReceivers.length}
              sub="After filters"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Assigned Today"
              value={totalAssigned}
              sub="Across receivers"
            />
          </div>
        </div>

        {/* Right rail */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Data
            </h3>
            <button
              onClick={refetch}
              disabled={fetching || !companyId}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCw
                className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• Shows all lead operators, even if disabled.</li>
            <li>
              • Receiver/Hybrid companies can toggle <b>Can Receive Leads</b>{" "}
              and set limits.
            </li>
          </ul>
        </div>
      </div>

      {/* Assigned per receiver */}
      <section className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Assigned today by receiver
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: {totalAssigned}
          </p>
        </div>

        <div className="space-y-3">
          {assignedRows.length === 0 && !loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No assignments yet today.
            </div>
          )}

          {assignedRows.map((row) => (
            <div key={row.receiverId} className="flex items-center gap-4">
              <div className="w-56 shrink-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {row.name}{" "}
                  <span className="text-gray-400 font-normal">
                    {row.employeeId ? `(${row.employeeId})` : ""}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-2 rounded-full bg-gray-900 dark:bg-gray-200 transition-[width]"
                    style={{ width: `${(row.count / maxAssigned) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-12 text-right text-sm text-gray-700 dark:text-gray-200">
                {row.count}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Receivers table */}
      <section className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Receivers (lead operators)
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredReceivers.length} of {receivers.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or ID"
                className="pl-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
              />
            </div>
            <button
              onClick={() => setOnlyEligible((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                onlyEligible
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              }`}
            >
              <Filter className="h-4 w-4" />
              {onlyEligible ? "Receive Enabled: On" : "Eligible: All"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Employee ID</th>
                <th className="py-2 pr-3">Can Receive Leads</th>
                <th className="py-2 pr-3">Daily Limit</th>
                <th className="py-2 pr-3">Assigned Today</th>
                <th className="py-2 pr-3">Last Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredReceivers.map((r) => {
                const assigned = assignedMap[r._id] || 0;
                const enabled = !!r.canReceiveLeads;
                return (
                  <tr key={r._id} className="text-gray-800 dark:text-gray-100">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3">{r.employeeId || "—"}</td>

                    {/* single-row toggle */}
                    <td className="py-2 pr-3">
                      <button
                        onClick={() =>
                          updateReceiver(r._id, { canReceiveLeads: !enabled })
                        }
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 transition ${
                          enabled
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 ring-gray-200 dark:ring-gray-700"
                        }`}
                      >
                        {enabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>

                    {/* daily limit */}
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0}
                        value={r.dailyCap ?? 0}
                        onChange={(e) => {
                          const v = Math.max(
                            0,
                            Math.floor(Number(e.target.value) || 0)
                          );
                          setReceivers((list) =>
                            list.map((x) =>
                              x._id === r._id ? { ...x, dailyCap: v } : x
                            )
                          );
                        }}
                        onBlur={async (e) => {
                          const v = Math.max(
                            0,
                            Math.floor(Number(e.currentTarget.value) || 0)
                          );
                          await updateReceiver(r._id, { dailyCap: v });
                        }}
                        className="w-24 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                      />
                    </td>

                    <td className="py-2 pr-3">
                      {assigned}
                      {(r.dailyCap ?? 0) > 0 ? ` / ${r.dailyCap}` : null}
                    </td>

                    <td className="py-2 pr-3">
                      {r.lastReceivedAt
                        ? new Date(r.lastReceivedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {!filteredReceivers.length && (
                <tr>
                  <td
                    className="py-3 text-gray-500 dark:text-gray-400"
                    colSpan={6}
                  >
                    No lead operators found for this company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && (
        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Loading…
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}
