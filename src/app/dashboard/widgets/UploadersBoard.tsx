"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// API shape: ONLY lead stats (no screenshots or statuses)
type Leader = {
  name: string;
  employee_id: string;
  totalLeads: number;
  positionChange?: "up" | "down" | "same" | "new";
};
type Api = {
  period: string; // e.g., "Sep 1–7, 2025" or "September 2025"
  range: "week" | "month" | "last3" | "year";
  leaders: Leader[]; // sorted desc by totalLeads
};

export default function UploadersBoard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<Api | null>(null);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<Api["range"]>("month");
  const [month, setMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    const q = new URLSearchParams({ range, companyId });
    if (range === "month") q.set("month", month);
    setLoading(true);
    fetch(`/api/leads/leaderboard?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res: Api) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId, range, month]);

  const leaders = data?.leaders || [];
  const top10 = leaders.slice(0, 10);

  const max = useMemo(
    () => Math.max(1, ...leaders.map((l) => l.totalLeads || 0)),
    [leaders]
  );

  // chart data (Top 10 only, bar of totalLeads)
  const chartData = useMemo(
    () =>
      top10.map((l) => ({
        name: l.name || l.employee_id,
        leads: l.totalLeads || 0,
      })),
    [top10]
  );

  return (
    <section className="space-y-6">
      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="Period" value={data?.period || "—"} />
        <KPI
          title="Top Uploader"
          value={top10[0]?.name || "—"}
          sub={`${top10[0]?.totalLeads ?? 0} leads`}
          icon={<Users className="h-4 w-4" />}
        />
        <KPI
          title="Total (Top 10)"
          value={top10.reduce((a, b) => a + (b.totalLeads || 0), 0).toString()}
        />
        <KPI
          title="Trend"
          value="—"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Api["range"])}
          className="h-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="last3">Last 3 Months</option>
          <option value="year">This Year</option>
        </select>

        {range === "month" && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
          />
        )}

        <button
          onClick={() => downloadCSV(data)}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-[var(--brand-600)] text-white shadow-sm hover:brightness-110"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Chart */}
      <Card title="Top 10 Uploaders — Total Leads">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chartData} barSize={18}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-200 dark:text-zinc-800"
              />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="leads" radius={[6, 6, 0, 0]} fill="#158d92" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Table */}
      <Card title={loading ? "Loading..." : "Leaderboard (All)"}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/60 dark:bg-zinc-900/40">
              <tr>
                <Th>#</Th>
                <Th>Name</Th>
                <Th>Employee ID</Th>
                <Th>Total Leads</Th>
                <Th>% of Top</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l, idx) => {
                const percent = Math.round(((l.totalLeads || 0) / max) * 100);
                return (
                  <motion.tr
                    key={l.employee_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-gray-100 dark:border-zinc-800 hover:bg-white/60 dark:hover:bg-zinc-900/50"
                  >
                    <Td className="font-medium">{idx + 1}</Td>
                    <Td className="font-medium">{l.name}</Td>
                    <Td>{l.employee_id}</Td>
                    <Td className="font-semibold text-[var(--brand-700)] dark:text-[var(--brand-400)]">
                      {l.totalLeads}
                    </Td>
                    <Td>{percent}%</Td>
                    <Td>{badge(l.positionChange)}</Td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

/* UI helpers */
function KPI({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {title}
        </span>
        {icon ?? <span />}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-zinc-100">
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-zinc-400">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2 text-gray-800 dark:text-zinc-200 ${className}`}>
      {children}
    </td>
  );
}

function badge(c: Leader["positionChange"]) {
  if (c === "up")
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">
        Up
      </span>
    );
  if (c === "down")
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700">
        Down
      </span>
    );
  if (c === "new")
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
        New
      </span>
    );
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
      —
    </span>
  );
}

/* CSV export (lead counts only) */
function downloadCSV(api: Api | null) {
  if (!api) return;
  const rows = api.leaders.map((l) => ({
    name: l.name,
    employee_id: l.employee_id,
    totalLeads: l.totalLeads,
    period: api.period,
    range: api.range,
  }));
  const csv = [
    Object.keys(rows[0] || {}).join(","),
    ...rows.map((r) => Object.values(r).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lead-uploaders-${api.period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
