"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiCheckCircle,
  FiUserX,
  FiUsers,
  FiChevronDown,
  FiSearch,
  FiDownload,
  FiSliders,
  FiAlertCircle,
  FiLoader,
  FiRefreshCcw,
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
} from "react-icons/fi";

/* ---------------- Types ---------------- */
type Company = {
  _id: string;
  name: string;
  roleMode?: "uploader" | "receiver" | "hybrid";
};

type SummaryRow = {
  employeeId: string;
  name: string;
  email?: string;
  total: number;
  approved: number;
  rejected: number;
  assigned: number;
};

type SortKey =
  | "name"
  | "employeeId"
  | "total"
  | "approved"
  | "assigned"
  | "working"
  | "pending"
  | "rejected";

/* ---------------- Helpers ---------------- */
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
function toCSV(rows: SummaryRow[]) {
  const header = [
    "Employee ID",
    "Name",
    "Email",
    "Total",
    "Approved",
    "Assigned",
    "Working",
    "Pending",
    "Rejected",
  ];
  const body = rows.map((r) =>
    [
      r.employeeId ?? "",
      r.name ?? "",
      r.email ?? "",
      r.total ?? 0,
      r.approved ?? 0,
      r.assigned ?? 0,

      r.rejected ?? 0,
    ]
      .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}
function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------- Page ---------------- */
export default function AdminReceiverLeadSummaryPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>(
    params.get("companyId") || ""
  );

  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(
    params.get("day") || ""
  );

  const [viewMode, setViewMode] = useState<"all" | "day">(
    (params.get("mode") as "all" | "day") || "day"
  );

  const [data, setData] = useState<SummaryRow[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Errors / guard
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [softError, setSoftError] = useState<string | null>(null);

  // UX controls
  const [q, setQ] = useState(params.get("q") || "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    (typeof window !== "undefined" &&
      (localStorage.getItem("receiver-summary:density") as
        | "comfortable"
        | "compact")) ||
      "comfortable"
  );
  const [sortKey, setSortKey] = useState<SortKey>(
    (params.get("sortKey") as SortKey) || "total"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    (params.get("sortDir") as "asc" | "desc") || "desc"
  );

  // persist density
  useEffect(() => {
    try {
      localStorage.setItem("receiver-summary:density", density);
    } catch {}
  }, [density]);

  // reflect key filters in URL (nice for refresh/share)
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    companyId ? sp.set("companyId", companyId) : sp.delete("companyId");
    selectedDay ? sp.set("day", selectedDay) : sp.delete("day");
    sp.set("mode", viewMode);
    q ? sp.set("q", q) : sp.delete("q");
    sp.set("sortKey", sortKey);
    sp.set("sortDir", sortDir);
    router.replace(`?${sp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedDay, viewMode, q, sortKey, sortDir]);

  // debounce search
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  /* -------- Load receiver/hybrid companies (authoritative) -------- */
  useEffect(() => {
    (async () => {
      try {
        setFatalError(null);
        setSoftError(null);
        const res = await fetch("/api/admin/receiver/companies", {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.replace("/unauthorize");
          return;
        }
        // IMPORTANT: do NOT redirect on 403; show guard instead.
        if (res.status === 403) {
          setFatalError(
            "You don’t have access to receiver companies with this account."
          );
          setCompanies([]);
          return;
        }
        const json = await res.json();
        if (!json.success) {
          setFatalError("Couldn’t load your receiver companies.");
          return;
        }
        const list: Company[] = json.companies || [];
        setCompanies(list);
        // Default-select a valid receiver/hybrid company
        const initial =
          companyId && list.find((c) => c._id === companyId)
            ? companyId
            : list[0]?._id;
        setCompanyId(initial || "");
      } catch {
        setFatalError("Network error while loading companies.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Load working days for selected company -------- */
  useEffect(() => {
    if (!companyId) {
      setWorkingDays([]);
      setSelectedDay("");
      return;
    }
    (async () => {
      setLoadingDays(true);
      setSoftError(null);
      try {
        const res = await fetch(
          `/api/admin/receiver/working-days?companyId=${encodeURIComponent(
            companyId
          )}`,
          { cache: "no-store" }
        );
        if (res.status === 401) {
          router.replace("/unauthorize");
          return;
        }
        if (res.status === 403) {
          // keep UI; show guard message and clear days
          setSoftError("You don’t have receiver access for this company.");
          setWorkingDays([]);
          setSelectedDay("");
          return;
        }
        const json = await res.json();
        if (json.success) {
          const days: string[] = json.days || [];
          setWorkingDays(days);
          // keep previously selectedDay if still present, else pick latest
          const pick = days.includes(selectedDay) ? selectedDay : days[0] || "";
          setSelectedDay(pick);
        } else {
          setSoftError("Failed to load working days.");
        }
      } catch {
        setSoftError("Network error while loading working days.");
      } finally {
        setLoadingDays(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  /* -------- Load summary (all-time or specific day) -------- */
  async function loadSummary() {
    if (!companyId) {
      setData([]);
      return;
    }
    setLoadingSummary(true);
    setSoftError(null);
    try {
      const query = new URLSearchParams({ companyId });
      if (viewMode === "day" && selectedDay) query.set("day", selectedDay);
      const res = await fetch(
        `/api/admin/receiver/lead-summary?${query.toString()}`,
        {
          cache: "no-store",
        }
      );
      if (res.status === 401) {
        router.replace("/unauthorize");
        return;
      }
      if (res.status === 403) {
        setSoftError(
          "You don’t have permission to view this summary for the selected company."
        );
        setData([]);
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.summary || []);
      else setSoftError("Failed to load lead summary.");
    } catch {
      setSoftError("Network error while loading lead summary.");
    } finally {
      setLoadingSummary(false);
    }
  }
  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, viewMode, selectedDay]);

  /* -------- Derived totals + filters + sort -------- */
  const totals = useMemo(() => {
    return {
      total: data.reduce((a, r) => a + (r.total || 0), 0),
      approved: data.reduce((a, r) => a + (r.approved || 0), 0),
      assigned: data.reduce((a, r) => a + (r.assigned || 0), 0),

      rejected: data.reduce((a, r) => a + (r.rejected || 0), 0),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const s = debouncedQ.trim().toLowerCase();
    let rows = s
      ? data.filter(
          (r) =>
            r.name?.toLowerCase().includes(s) ||
            r.employeeId?.toLowerCase().includes(s) ||
            r.email?.toLowerCase().includes(s)
        )
      : data.slice();

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name" || sortKey === "employeeId") {
        const av = String((a as any)[sortKey] || "");
        const bv = String((b as any)[sortKey] || "");
        return av.localeCompare(bv) * dir;
      } else {
        const av = Number((a as any)[sortKey] || 0);
        const bv = Number((b as any)[sortKey] || 0);
        return (av - bv) * dir;
      }
    });
    return rows;
  }, [data, debouncedQ, sortKey, sortDir]);

  /* -------- Handlers -------- */
  const exportCSV = () => {
    const filename =
      viewMode === "day" && selectedDay
        ? `receiver-summary_${selectedDay}.csv`
        : `receiver-summary_all-time.csv`;
    download(filename, toCSV(filtered));
  };
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "employeeId" ? "asc" : "desc");
    }
  };
  const densityBtn = (val: "comfortable" | "compact") => (
    <button
      onClick={() => setDensity(val)}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md border transition",
        density === val
          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900/10 dark:border-gray-300"
          : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
      )}
      aria-pressed={density === val}
    >
      {val === "comfortable" ? "Comfortable" : "Compact"}
    </button>
  );

  /* -------- Render -------- */
  const cellPad = density === "compact" ? "py-1.5 px-2" : "py-2.5 px-3";

  return (
    <div className="px-4 sm:px-8 py-6 container mx-auto">
      {/* Fatal guard */}
      {fatalError && (
        <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {fatalError}
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Receiver Lead Summary — Admin
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Admin/Superadmin only • Visible for companies where your
              membership is in <b>Receiver</b> (or Hybrid, if enabled) mode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Company selector */}
            <div className="relative">
              <label className="sr-only" htmlFor="companySelect">
                Company
              </label>
              <select
                id="companySelect"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="appearance-none pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {/* View toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-3 py-2 text-sm rounded-md border transition",
                  viewMode === "all"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900/10 dark:border-gray-300"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                )}
                aria-pressed={viewMode === "all"}
              >
                All Time
              </button>

              <div className="relative">
                <label className="sr-only" htmlFor="daySelect">
                  Working Day
                </label>
                <select
                  id="daySelect"
                  disabled={loadingDays || !workingDays.length}
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setViewMode("day");
                  }}
                  className={cn(
                    "appearance-none pr-8 rounded-lg border px-3 py-2 text-sm",
                    "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100",
                    loadingDays
                      ? "border-gray-200 dark:border-gray-700 opacity-70"
                      : "border-blue-300 dark:border-blue-700"
                  )}
                >
                  {workingDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Soft error / info */}
      {softError && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {softError}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        {/* Controls (responsive) */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 min-w-0">
          {/* Search */}
          <div className="relative w-full sm:w-64 md:w-72 min-w-0">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, ID, or email"
              className="w-full pl-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
              aria-label="Search rows"
            />
          </div>

          {/* Sort group */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex text-xs text-gray-500 dark:text-gray-400 items-center gap-1">
              <FiSliders /> Sort
            </span>
            <label className="sr-only" htmlFor="sortKey">
              Sort key
            </label>
            <select
              id="sortKey"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="max-w-[55vw] sm:max-w-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
            >
              <option value="total">Total</option>
              <option value="approved">Approved</option>
              <option value="assigned">Assigned</option>
              <option value="rejected">Rejected</option>
              <option value="name">Name</option>
              <option value="employeeId">Employee ID</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm inline-flex items-center gap-1"
              title="Toggle sort direction"
              aria-label="Toggle sort direction"
            >
              {sortDir === "asc" ? <FiArrowUp /> : <FiArrowDown />}
              <span className="hidden sm:inline">{sortDir.toUpperCase()}</span>
            </button>
          </div>

          {/* Density (hide on small) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Density
            </span>
            {densityBtn("comfortable")}
            {densityBtn("compact")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSummary}
            disabled={loadingSummary}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
              loadingSummary && "opacity-70 cursor-not-allowed"
            )}
            title="Refresh data"
          >
            <FiRefreshCcw
              className={cn("h-4 w-4", loadingSummary && "animate-spin")}
            />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            title="Export CSV"
          >
            <FiDownload className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Totals bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat title="Total" value={totals.total} />
        <Stat
          title="Approved"
          value={totals.approved}
          icon={<FiCheckCircle />}
          accent="green"
        />
        <Stat title="Assigned" value={totals.assigned} icon={<FiUsers />} />
        <Stat
          title="Rejected"
          value={totals.rejected}
          icon={<FiUserX />}
          accent="red"
        />
      </section>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/70 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:supports-[backdrop-filter]:bg-gray-900/60 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <Th label="#" className={cn(cellPad, "text-left w-14")} />
                <Th
                  label="Name (ID)"
                  className={cn(cellPad, "text-left min-w-[240px]")}
                  sortable
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <Th
                  label="Total"
                  className={cn(cellPad, "text-right")}
                  sortable
                  active={sortKey === "total"}
                  dir={sortDir}
                  onClick={() => toggleSort("total")}
                />
                <Th
                  label={
                    <div className="inline-flex items-center gap-1">
                      <FiCheckCircle /> Approved
                    </div>
                  }
                  className={cn(
                    cellPad,
                    "text-right text-green-700 dark:text-green-300"
                  )}
                  sortable
                  active={sortKey === "approved"}
                  dir={sortDir}
                  onClick={() => toggleSort("approved")}
                />
                <Th
                  label={
                    <div className="inline-flex items-center gap-1">
                      <FiUsers /> Assigned
                    </div>
                  }
                  className={cn(cellPad, "text-right")}
                  sortable
                  active={sortKey === "assigned"}
                  dir={sortDir}
                  onClick={() => toggleSort("assigned")}
                />

                <Th
                  label={
                    <div className="inline-flex items-center gap-1">
                      <FiUserX /> Rejected
                    </div>
                  }
                  className={cn(
                    cellPad,
                    "text-right text-red-700 dark:text-red-300"
                  )}
                  sortable
                  active={sortKey === "rejected"}
                  dir={sortDir}
                  onClick={() => toggleSort("rejected")}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingSummary ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className={cn(cellPad)}>
                      <Sk w="w-6" />
                    </td>
                    <td className={cn(cellPad)}>
                      <Sk w="w-48" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      <Sk w="w-10 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={cn(cellPad, "text-center")}>
                    <div className="mx-auto max-w-md p-6 text-gray-600 dark:text-gray-300">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FiLoader className="animate-spin" />
                        {softError
                          ? softError
                          : "No data found for current filters."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr
                    key={`${row.employeeId || row.email || row.name}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td
                      className={cn(
                        cellPad,
                        "text-left text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {idx + 1}
                    </td>
                    <td className={cn(cellPad, "text-left")}>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {row.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {row.employeeId || "—"}
                        {row.email ? ` • ${row.email}` : ""}
                      </div>
                    </td>
                    <td className={cn(cellPad, "text-right font-semibold")}>
                      {row.total}
                    </td>
                    <td
                      className={cn(
                        cellPad,
                        "text-right text-green-700 dark:text-green-300"
                      )}
                    >
                      {row.approved || 0}
                    </td>
                    <td className={cn(cellPad, "text-right")}>
                      {row.assigned || 0}
                    </td>

                    <td
                      className={cn(
                        cellPad,
                        "text-right text-red-700 dark:text-red-300"
                      )}
                    >
                      {row.rejected || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals row footer (visible when data present) */}
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50/70 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800">
                <tr>
                  <td className={cn(cellPad)} />
                  <td
                    className={cn(
                      cellPad,
                      "text-left font-medium text-gray-700 dark:text-gray-300"
                    )}
                  >
                    Totals (visible rows)
                  </td>
                  <td className={cn(cellPad, "text-right font-semibold")}>
                    {filtered.reduce((a, r) => a + (r.total || 0), 0)}
                  </td>
                  <td className={cn(cellPad, "text-right")}>
                    {filtered.reduce((a, r) => a + (r.approved || 0), 0)}
                  </td>
                  <td className={cn(cellPad, "text-right")}>
                    {filtered.reduce((a, r) => a + (r.assigned || 0), 0)}
                  </td>

                  <td className={cn(cellPad, "text-right")}>
                    {filtered.reduce((a, r) => a + (r.rejected || 0), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer strip */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <FiCalendar />
              {viewMode === "day" ? selectedDay || "—" : "All Time"}
            </span>
            <span>•</span>
            <span>{filtered.length} row(s)</span>
          </div>
          <div className="inline-flex items-center gap-1">
            <FiAlertCircle /> Manual refresh (use the Refresh button)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small UI atoms ---------------- */
function Sk({ w = "w-10" }: { w?: string }) {
  return <div className={cn("h-3 rounded bg-gray-200 dark:bg-gray-800", w)} />;
}

function Th({
  label,
  className,
  sortable = false,
  active = false,
  dir = "asc",
  onClick,
}: {
  label: React.ReactNode;
  className?: string;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  return (
    <th
      scope="col"
      className={cn(className, sortable && "cursor-pointer select-none")}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      onClick={sortable ? onClick : undefined}
    >
      <div className="inline-flex items-center gap-1">
        {label}
        {sortable && active ? (
          dir === "asc" ? (
            <FiArrowUp />
          ) : (
            <FiArrowDown />
          )
        ) : null}
      </div>
    </th>
  );
}

/* ---------------- UI: Stat card ---------------- */
function Stat({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon?: React.ReactNode;
  accent?: "green" | "amber" | "red";
}) {
  const ring =
    accent === "green"
      ? "ring-green-200 dark:ring-green-900/40"
      : accent === "amber"
      ? "ring-amber-200 dark:ring-amber-900/40"
      : accent === "red"
      ? "ring-red-200 dark:ring-red-900/40"
      : "ring-gray-200 dark:ring-gray-800";

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 ring-1",
        ring
      )}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
        {icon ? <span className="text-sm">{icon}</span> : null}
        {value}
      </div>
    </div>
  );
}
