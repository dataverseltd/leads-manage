"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import Link from "next/link";
import {
  FiAward,
  FiDownload,
  FiChevronUp,
  FiChevronDown,
  FiMinus,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiSliders,
  FiRefreshCw,
} from "react-icons/fi";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { Bar } from "react-chartjs-2";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import dayjs from "dayjs";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Range = "week" | "month" | "year" | "last3";
type PositionChange = "up" | "down" | "same" | "new";

type Leader = {
  userId: string;
  name: string;
  employee_id: string;
  totalLeads: number;
  isNew?: boolean;
  positionChange?: PositionChange;
  statuses?: Record<string, number>;
};

type ApiResponse = {
  period: string;
  range: Range;
  availableStatuses: string[];
  leaders: Leader[];
};
type ExtendedUser = Session["user"] & {
  employee_id?: string;
  employeeId?: string;
};
type MySession = Session & { user?: ExtendedUser };

const STATUS_ORDER = [
  "approved",
  "in_progress",
  "assigned",
  "pending",
  "rejected",
] as const;

export default function UploaderDashboardPage() {
  const { data } = useSession(); // no generic here
  const session = (data || {}) as MySession;

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string>("");

  const [range, setRange] = useState<Range>("month");
  const [periodLabel, setPeriodLabel] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM")
  );

  // Filters & UX
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]); // empty = all
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState<"normal" | "compact">("normal");

  // 👇 NEW STATE
  const [myCompanies, setMyCompanies] = useState<
    { _id: string; name: string }[]
  >([]);
  const [companyId, setCompanyId] = useState<string>("");

  // highlight current user (no any)
  const currentEmployeeId =
    session.user?.employee_id ?? session.user?.employeeId ?? "";

  // 👇 Load memberships FIRST
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch("/api/admin/companies?scope=memberships");
        if (!resp.ok) return;

        const data = await resp.json();
        setMyCompanies(data || []);

        // Auto-select if only one company
        if (data?.length === 1) {
          setCompanyId(data[0]._id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, []);

  // 👇 Fetch leaderboard (but ONLY after companyId is ready)
  const fetchLeaders = useCallback(async () => {
    if (myCompanies.length === 0) return; // not yet loaded memberships
    if (myCompanies.length === 1 && !companyId) return; // wait for auto-select

    setLoading(true);
    setFetchError("");

    const qs = new URLSearchParams({ range });

    if (range === "month" && selectedMonth) qs.set("month", selectedMonth);
    if (companyId) qs.set("companyId", companyId);

    try {
      const res = await fetch(`/api/uploader/leaderboard?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setLeaders([]);
        setAvailableStatuses([]);
        setPeriodLabel("");
        setFetchError(`Failed to load (${res.status})`);
        setLoading(false);
        return;
      }

      const data: ApiResponse = await res.json();

      setLeaders(data.leaders || []);
      setAvailableStatuses(data.availableStatuses || []);
      setPeriodLabel(data.period || "");
    } catch {
      setFetchError("Network error");
      setLeaders([]);
      setAvailableStatuses([]);
      setPeriodLabel("");
    } finally {
      setLoading(false);
    }
  }, [range, selectedMonth, companyId, myCompanies]);

  // 👇 Re-run leaderboard whenever range, month, or company changes
  useEffect(() => {
    fetchLeaders();
  }, [range, selectedMonth, companyId, myCompanies, fetchLeaders]);

  // Derived
  const maxTotal = useMemo(
    () => Math.max(1, ...leaders.map((l) => l.totalLeads || 0)),
    [leaders]
  );

  // Search + status filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leaders.filter((l) => {
      const nameHit =
        !q ||
        l.name?.toLowerCase().includes(q) ||
        l.employee_id?.toLowerCase().includes(q);

      const statusHit =
        activeStatuses.length === 0 ||
        activeStatuses.some((s) => (l.statuses?.[s] ?? 0) > 0);

      return nameHit && statusHit;
    });
  }, [leaders, query, activeStatuses]);

  // KPI cards
  const kpi = useMemo(() => {
    const total = filtered.reduce((a, b) => a + (b.totalLeads || 0), 0);
    const sumBy = (key: string) =>
      filtered.reduce((a, b) => a + Number(b.statuses?.[key] || 0), 0);
    return {
      total,
      approved: sumBy("approved"),
      pending: sumBy("pending"),
      rejected: sumBy("rejected"),
      assigned: sumBy("assigned"),
    };
  }, [filtered]);

  // Chart (top 10 of filtered)
  const top10 = filtered.slice(0, 10);
  const chartLabels = top10.map((l) => l.name || l.employee_id);

  const palette = useMemo(() => {
    const defaults = [
      "#3B82F6", // blue
      "#10B981", // emerald
      "#F59E0B", // amber
      "#EF4444", // red
      "#8B5CF6", // violet
      "#06B6D4", // cyan
      "#F97316", // orange
      "#22C55E", // green
    ];
    const map: Record<string, string> = {};
    const base = availableStatuses.length
      ? availableStatuses
      : (STATUS_ORDER as unknown as string[]);
    base.forEach((s, i) => (map[s] = defaults[i % defaults.length]));
    return map;
  }, [availableStatuses]);

  const showStatuses = (
    activeStatuses.length ? activeStatuses : availableStatuses
  ).filter(Boolean);
  const stackedDatasets = showStatuses.map((status) => ({
    label: status,
    data: top10.map((l) => Number(l.statuses?.[status] || 0)),
    backgroundColor: palette[status] || "#3B82F6",
    borderRadius: 6,
    stack: "total",
  }));

  const chartData = { labels: chartLabels, datasets: stackedDatasets };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    scales: {
      x: {
        stacked: true,
        ticks: { color: getCssVar("--color-chart-text") || "#64748B" },
      },
      y: {
        beginAtZero: true,
        stacked: true,
        ticks: {
          stepSize: 1,
          color: getCssVar("--color-chart-text") || "#64748B",
        },
        grid: { color: getCssVar("--color-chart-grid") || "#E5E7EB" },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: { color: getCssVar("--color-chart-text") || "#64748B" },
      },
      tooltip: { mode: "index", intersect: false },
    },
  };

  function getCssVar(name: string) {
    if (typeof window === "undefined") return undefined;
    return (
      getComputedStyle(document.documentElement).getPropertyValue(name) ||
      undefined
    );
  }

  // Export CSV (filtered)
  const downloadCSV = () => {
    const rows = filtered.map((l) => ({
      name: l.name,
      employee_id: l.employee_id,
      totalLeads: l.totalLeads,
      ...availableStatuses.reduce((acc, s) => {
        acc[`status_${s}`] = l.statuses?.[s] ?? 0;
        return acc;
      }, {} as Record<string, number>),
      positionChange: l.positionChange,
      isNew: l.isNew ? 1 : 0,
      period: periodLabel,
      range,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    import("file-saver").then(({ saveAs }) =>
      saveAs(blob, `uploader-leaderboard-${range}-${periodLabel}.csv`)
    );
  };

  const myIndex = filtered.findIndex(
    (u) => u.employee_id === currentEmployeeId
  );
  const tableRef = useRef<HTMLTableElement | null>(null);
  const jumpToMe = () => {
    if (myIndex < 0 || !tableRef.current) return;
    const row = tableRef.current.querySelectorAll("tbody tr")[myIndex] as
      | HTMLElement
      | undefined;
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("ring-2", "ring-emerald-400");
    setTimeout(() => row?.classList.remove("ring-2", "ring-emerald-400"), 1200);
  };

  // UI helpers
  const ChangeIcon = ({ change }: { change?: Leader["positionChange"] }) => {
    if (change === "up")
      return <FiChevronUp className="text-emerald-600 dark:text-emerald-400" />;
    if (change === "down")
      return <FiChevronDown className="text-red-600 dark:text-red-400" />;
    if (change === "new")
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
          NEW
        </span>
      );
    return <FiMinus className="text-gray-400" />;
  };

  const rowPad = density === "compact" ? "py-2" : "py-3";

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-[#f9f8ff] to-[#fbfcff] dark:from-[#05080f3f] dark:to-[#17214179]">
      {/* Sticky Toolbar */}
      <div className=" backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-slate-900/50 bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 rounded-xl shadow-sm p-3 mb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FiAward className="text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Uploader Leaderboard
              </h1>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Period: {periodLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {myCompanies.length > 1 && (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-9 rounded-md border border-slate-300 dark:border-slate-700 
    bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {myCompanies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {myCompanies.length === 1 && (
              <span
                className="text-xs px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 
    text-blue-700 dark:text-blue-300"
              >
                {myCompanies[0].name}
              </span>
            )}

            {/* Range */}
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="range">
                Range
              </label>
              <select
                id="range"
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                className="h-9 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select time range"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="last3">Last 3 Months</option>
                <option value="year">This Year</option>
              </select>

              {/* Month navigator */}
              {range === "month" && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedMonth.split("-").map(Number);
                      const d = new Date(y, m - 1, 1);
                      d.setMonth(d.getMonth() - 1);
                      setSelectedMonth(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                          2,
                          "0"
                        )}`
                      );
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                    aria-label="Previous month"
                    title="Previous month"
                  >
                    <FiChevronLeft />
                  </button>

                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Select month"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedMonth.split("-").map(Number);
                      const d = new Date(y, m - 1, 1);
                      d.setMonth(d.getMonth() + 1);
                      setSelectedMonth(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                          2,
                          "0"
                        )}`
                      );
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                    aria-label="Next month"
                    title="Next month"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or ID…"
                className="h-9 w-48 md:w-64 rounded-md pl-8 pr-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search by name or employee ID"
              />
            </div>

            {/* Density */}
            <button
              onClick={() =>
                setDensity((d) => (d === "normal" ? "compact" : "normal"))
              }
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Toggle row density"
              title="Toggle row density"
            >
              <FiSliders />
              {density === "compact" ? "Compact" : "Comfort"}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchLeaders}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Refresh data"
              title="Refresh"
            >
              <FiRefreshCw />
              Refresh
            </button>

            {/* Export */}
            <button
              onClick={downloadCSV}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 text-sm font-medium"
              aria-label="Export CSV"
              title="Export CSV"
            >
              <FiDownload />
              Export
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(availableStatuses.length
            ? availableStatuses
            : Array.from(STATUS_ORDER)
          ).map((s) => {
            const on = activeStatuses.includes(s);
            return (
              <button
                key={s}
                onClick={() =>
                  setActiveStatuses((prev) =>
                    on ? prev.filter((x) => x !== s) : [...prev, s]
                  )
                }
                className={`px-3 h-8 rounded-full text-sm border transition
                ${
                  on
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                aria-pressed={on}
              >
                {labelize(s)}
              </button>
            );
          })}
          {activeStatuses.length > 0 && (
            <button
              onClick={() => setActiveStatuses([])}
              className="px-3 h-8 rounded-full text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        <Stat title="Total" value={kpi.total} />
        <Stat title="Approved" value={kpi.approved} accent="emerald" />
        <Stat title="Assigned" value={kpi.assigned} accent="cyan" />
        <Stat title="Pending" value={kpi.pending} accent="amber" />
        <Stat title="Rejected" value={kpi.rejected} accent="red" />
      </section>

      {/* My Rank + Jump */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-700 dark:text-slate-300">
          {myIndex >= 0 ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              My Rank: <strong>#{myIndex + 1}</strong>
              <button
                onClick={jumpToMe}
                className="ml-2 underline hover:no-underline"
                aria-label="Jump to my row"
              >
                Jump to me
              </button>
            </span>
          ) : (
            <span className="opacity-70">
              You are not in this list for current filters.
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6 rounded-xl p-4 shadow-md border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70">
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
          Top 10 Uploaders (Stacked by Status)
        </h2>
        <div className="h-72">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl shadow-md border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-300">
            {fetchError ? (
              <div>
                <p className="font-medium mb-1">Couldn’t load data.</p>
                <p className="text-sm opacity-80">{fetchError}</p>
              </div>
            ) : (
              <div>
                <p className="font-medium mb-1">
                  No uploads match your filters.
                </p>
                <p className="text-sm opacity-80">
                  Try clearing search or status chips.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm">
              <thead className=" z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 text-left text-slate-700 dark:text-slate-300">
                <tr>
                  <Th>#</Th>
                  <Th>Name</Th>
                  <Th>Employee ID</Th>
                  {showStatuses.map((s) => (
                    <Th key={s}>{labelize(s)}</Th>
                  ))}
                  <Th>Total</Th>
                  <Th>% of Top</Th>
                  <Th>Change</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const isCurrent = u.employee_id === currentEmployeeId;
                  const percent = Math.round((u.totalLeads / maxTotal) * 100);

                  return (
                    <motion.tr
                      key={u.userId}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 22,
                      }}
                      className={`border-t border-slate-200 dark:border-slate-800 transition
                        ${
                          isCurrent
                            ? "bg-emerald-50/60 dark:bg-emerald-900/20"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        }
                      `}
                    >
                      <Td className={rowPad}>
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/5 dark:bg-white/10">
                          {idx + 1}
                        </span>
                      </Td>

                      <Td className={rowPad}>
                        <Link
                          href={`/dashboard/admin/uploader/employee/${u.employee_id}?companyId=${companyId}`}
                          className="text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          {u.name || u.employee_id}
                        </Link>
                      </Td>

                      <Td className={`${rowPad} flex items-center gap-2`}>
                        <span className="font-mono">{u.employee_id}</span>
                      </Td>

                      {showStatuses.map((s) => (
                        <Td key={s} className={rowPad}>
                          {u.statuses?.[s] ?? 0}
                        </Td>
                      ))}

                      <Td
                        className={`${rowPad} font-semibold text-blue-700 dark:text-blue-300`}
                      >
                        {u.totalLeads}
                      </Td>
                      <Td className={rowPad}>{percent}%</Td>
                      <Td className={rowPad}>
                        <ChangeIcon change={u.positionChange} />
                      </Td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Small UI bits ---------------- */

function labelize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 ${className}`}>{children}</td>;
}

function Stat({
  title,
  value,
  accent,
}: {
  title: string;
  value: number | string;
  accent?: "emerald" | "violet" | "cyan" | "amber" | "red";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/70 dark:border-emerald-800"
      : accent === "violet"
      ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 border-violet-200/70 dark:border-violet-800"
      : accent === "cyan"
      ? "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200/70 dark:border-cyan-800"
      : accent === "amber"
      ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-800"
      : accent === "red"
      ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200/70 dark:border-red-800"
      : "text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800";

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${color}`}>
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-md bg-slate-200/60 dark:bg-slate-800/60" />
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-8 md:grid-cols-12 gap-3 px-4 py-3"
        >
          {Array.from({ length: 12 }).map((__, j) => (
            <div
              key={j}
              className="h-4 rounded bg-slate-200/70 dark:bg-slate-800/70"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
