"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type FB = {
  totals: {
    submitted: number;
    approved: number;
    rejected: number;
    pending: number;
    in_progress: number;
  };
  bySubmitter: { name: string; count: number }[];
  trend: {
    day: string;
    approved: number;
    rejected: number;
    pending: number;
    in_progress: number;
  }[];
};

export default function FbAnalyticsBoard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<FB | null>(null);
  useEffect(() => {
    fetch(`/api/fb-ids/analytics?companyId=${companyId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [companyId]);

  return (
    <section className="space-y-6">
      <div className="grid sm:grid-cols-5 gap-4">
        <KPI label="Submitted" value={data?.totals.submitted ?? 0} />
        <KPI label="Approved" value={data?.totals.approved ?? 0} />
        <KPI label="Rejected" value={data?.totals.rejected ?? 0} />
        <KPI label="Pending" value={data?.totals.pending ?? 0} />
        <KPI label="In Progress" value={data?.totals.in_progress ?? 0} />
      </div>

      <Card title="Top Submitters (30d)">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data?.bySubmitter || []} barSize={20}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-200 dark:text-zinc-800"
              />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#158d92" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Status Trend (30d)">
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data?.trend || []}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-200 dark:text-zinc-800"
              />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" stackId="a" fill="#10b981" />
              <Bar dataKey="pending" stackId="a" fill="#f59e0b" />
              <Bar dataKey="in_progress" stackId="a" fill="#3aa6ac" />
              <Bar dataKey="rejected" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
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
