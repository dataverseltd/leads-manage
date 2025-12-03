"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import dayjs from "dayjs";
import { FiChevronLeft, FiChevronRight, FiSearch } from "react-icons/fi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ---------------- Types ---------------- */
type EmployeeInfo = {
  _id: string;
  name: string;
  employee_id: string;
};

type LeadRow = {
  _id: string;
  fb_id_name: string;
  client_name: string;
  lead_status: string;
  workingDay: string;
  createdAt: string;
};

type Stats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  in_progress: number;
  assigned: number;
};

type MonthlyTrend = {
  month: string;
  total: number;
};

/* ---------------- UI ---------------- */
const STATUS_COLORS: Record<string, string> = {
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  in_progress:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  assigned:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

/* ---------------- PAGE ---------------- */
export default function EmployeeUploaderPerformancePage() {
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams();

  // MUST use useParams() for client components
  const employeeId = params.employeeId as string;

  // Passed from performance page
  const companyId = search.get("companyId") || "";

  /* ---------------- State ---------------- */
  const [month, setMonth] = useState(
    search.get("month") || dayjs().format("YYYY-MM")
  );

  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);

  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* ---------------- Fetch Monthly Stats ---------------- */
  const loadStats = useCallback(async () => {
    if (!companyId || !employeeId) return;

    setLoading(true);

    const qs = new URLSearchParams({
      month,
      companyId,
    });

    const resp = await fetch(
      `/api/admin/uploader/employee/${employeeId}?` + qs.toString()
    );

    const data = await resp.json();

    if (resp.ok) {
      setEmployee(data.employee || null);
      setStats(data.stats || null);
      setLeads(data.leads || []);
    }

    setLoading(false);
  }, [companyId, month, employeeId]);

  /* ---------------- Fetch 6-Month Trend ---------------- */
  const loadTrend = useCallback(async () => {
    if (!companyId || !employeeId) return;

    const resp = await fetch(
      `/api/admin/uploader/employee/${employeeId}/monthly-summary?companyId=${companyId}&months=6`
    );

    const data = await resp.json();

    if (resp.ok) {
      setTrend(data.months || []);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    loadStats();
    loadTrend();
  }, [loadStats, loadTrend]);

  /* ---------------- Filtering ---------------- */
  const filteredLeads = leads.filter((l) => {
    if (statusFilter !== "all" && l.lead_status !== statusFilter) return false;

    if (!query.trim()) return true;
    const q = query.toLowerCase();

    return (
      l.fb_id_name?.toLowerCase().includes(q) ||
      l.client_name?.toLowerCase().includes(q) ||
      l.lead_status?.toLowerCase().includes(q) ||
      l.workingDay?.toLowerCase().includes(q)
    );
  });

  /* ---------------- Month Navigation ---------------- */
  const changeMonth = (offset: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + offset);

    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    setMonth(newMonth);

    const params = new URLSearchParams(search.toString());
    params.set("month", newMonth);

    router.replace(`?${params.toString()}`);
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-semibold">Uploader Performance</h1>

        {employee && (
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">{employee.name}</span> (ID:{" "}
            {employee.employee_id})
          </p>
        )}

        {/* Month Input + Search */}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          {/* Month Selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="px-2 py-1 border rounded-md dark:border-slate-700"
            >
              <FiChevronLeft />
            </button>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />

            <button
              onClick={() => changeMonth(1)}
              className="px-2 py-1 border rounded-md dark:border-slate-700"
            >
              <FiChevronRight />
            </button>
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lead…"
              className="h-9 pl-8 pr-3 rounded-md border bg-white dark:bg-slate-900 text-sm dark:border-slate-700"
            />
          </div>
        </div>
      </div>

      {/* STATS */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat title="Total" value={stats.total} />
          <Stat title="Approved" value={stats.approved} accent="emerald" />
          <Stat title="Pending" value={stats.pending} accent="amber" />
          <Stat title="In Progress" value={stats.in_progress} accent="cyan" />
          <Stat title="Assigned" value={stats.assigned} accent="violet" />
          <Stat title="Rejected" value={stats.rejected} accent="red" />
        </div>
      )}

      {/* CHART */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow border border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold mb-3">Last 6 Months Trend</h2>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STATUS FILTER */}
      <div className="flex gap-2 flex-wrap">
        {[
          "all",
          "approved",
          "pending",
          "in_progress",
          "assigned",
          "rejected",
        ].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs border ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {s === "all"
              ? "All"
              : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm">Loading…</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-6 text-center text-sm">No leads found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <Th>FB Name</Th>
                <Th>Client Name</Th>
                <Th>Status</Th>
                <Th>Working Day</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((l) => (
                <tr
                  key={l._id}
                  className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Td>{l.fb_id_name}</Td>
                  <Td>{l.client_name}</Td>
                  <Td>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[l.lead_status] || "bg-slate-200"
                      }`}
                    >
                      {l.lead_status.replace("_", " ")}
                    </span>
                  </Td>
                  <Td>{l.workingDay}</Td>
                  <Td>{dayjs(l.createdAt).format("YYYY-MM-DD HH:mm")}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function Stat({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent?: "emerald" | "amber" | "cyan" | "red" | "violet";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
      : accent === "amber"
      ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20"
      : accent === "cyan"
      ? "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20"
      : accent === "red"
      ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20"
      : accent === "violet"
      ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20"
      : "text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-800";

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${color}`}>
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2">{children}</td>;
}
