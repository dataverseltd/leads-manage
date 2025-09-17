"use client";

import { useEffect, useState } from "react";
import { LineChart as LineChartIcon, PieChart as PieIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Summary = {
  productBreakdown: { name: string; value: number }[];
  trend: { day: string; count: number }[];
  totals: {
    screenshots: number;
    approved: number;
    pending: number;
    rejected: number;
  };
};

export default function ReceiversBoard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`/api/screenshots/summary?companyId=${companyId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [companyId]);

  const colors = [
    "#158d92",
    "#3aa6ac",
    "#70c3c8",
    "#9fd9dc",
    "#0e6f74",
    "#0a565b",
    "#063d41",
    "#042e31",
  ];

  return (
    <section className="space-y-6">
      <Card title="Today — Totals" subtitle="Company-wide (receivers)">
        <div className="grid sm:grid-cols-4 gap-4">
          <KPI label="Screenshots" value={data?.totals.screenshots ?? 0} />
          <KPI label="Approved" value={data?.totals.approved ?? 0} />
          <KPI label="Pending" value={data?.totals.pending ?? 0} />
          <KPI label="Rejected" value={data?.totals.rejected ?? 0} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="By Product (Today)" icon={<PieIcon className="h-4 w-4" />}>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  dataKey="value"
                  data={data?.productBreakdown || []}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {(data?.productBreakdown || []).map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="7-Day Trend" icon={<LineChartIcon className="h-4 w-4" />}>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data?.trend || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-zinc-800"
                />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#158d92"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function Card({
  title,
  children,
  subtitle,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-xs -mt-2 mb-3 text-gray-500">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
