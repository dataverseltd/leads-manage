"use client";

import Link from "next/link";
import clsx from "clsx";
import useSWR from "swr";
import { useCallback, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import toast from "react-hot-toast";
import PushManager from "@/components/push/PushManager";
import { useMultiCompanyScreenshotRT } from "@/hooks/useMultiCompanyRT";

type MatrixResp = {
  workingDay: string;
  isAdmin: boolean;
  companies: Array<{
    companyId: string;
    companyName: string;
    orderedProducts: string[];
    rows: Array<{
      _id: string; // uploader id or "null"
      employeeId: string | null;
      name: string;
      total: number;
      products: Record<string, number>;
    }>;
    columnTotals: Record<string, number>;
  }>;
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store", credentials: "same-origin" }).then(
    async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(t || r.statusText);
      return JSON.parse(t) as MatrixResp;
    }
  );

// Feel free to replace with your own mapping
function shortName(p: string) {
  // Keep title attr for full name; show compact header
  if (p.length <= 10) return p;
  return p.slice(0, 10) + "…";
}

export default function SummaryClient({ initialDay }: { initialDay: string }) {
  const [workingDay, setWorkingDay] = useState(initialDay);
  const [sortDesc, setSortDesc] = useState(true);

  const { data, mutate } = useSWR<MatrixResp>(
    `/api/dashboard/signup-summary/matrix?workingDay=${workingDay}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // RT: subscribe to all companies returned by API
  const companyIds = useMemo(
    () => (data?.companies || []).map((c) => c.companyId),
    [data?.companies]
  );

  const debRef = useRef<number | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(() => mutate(), 350);
  }, [mutate]);

  useMultiCompanyScreenshotRT({
    companyIds,
    workingDay,
    onUploaded: (e) => {
      toast.success(`New screenshot: ${e.productName}`);
      scheduleRefresh();
    },
    onReviewed: (e) => {
      toast(`Reviewed: ${e.productName}`, { icon: "✅" });
      scheduleRefresh();
    },
  });

  return (
    <div className="p-4 space-y-6">
      {/* enable push in the background */}
      <PushManager />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">
          Signup Summary
        </h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-neutral-300">
            Working Day
          </label>
          <input
            type="date"
            value={workingDay}
            onChange={(e) => setWorkingDay(e.target.value)}
            className="border rounded px-2 py-1 text-sm
                   bg-white text-gray-900 border-gray-300
                   dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
          />
          <button
            onClick={() => mutate()}
            className="px-3 py-1 border rounded text-sm
                   text-gray-900 border-gray-300 bg-white hover:bg-gray-50
                   dark:text-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {(data?.companies || []).length === 0 ? (
        <div className="border rounded p-6 text-gray-500 dark:text-neutral-400 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          No eligible companies or no screenshots on {workingDay}.
        </div>
      ) : (
        data!.companies.map((co) => {
          const sortedRows = [...co.rows].sort((a, b) =>
            sortDesc ? b.total - a.total : a.total - b.total
          );
          const grandTotal = sortedRows.reduce((sum, r) => sum + r.total, 0);

          return (
            <div
              key={co.companyId}
              className="border rounded-lg p-4 bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-base font-semibold text-gray-900 dark:text-neutral-100">
                  {co.companyName}
                </div>
                <div className="text-sm text-gray-600 dark:text-neutral-300">
                  Total:{" "}
                  <b className="text-gray-900 dark:text-neutral-100">
                    {grandTotal}
                  </b>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-blue-600 dark:bg-blue-700 text-white font-bold italic">
                      <th className="border border-blue-400/40 dark:border-blue-300/20 px-2 sm:px-3 py-2 text-[11px] sm:text-xs uppercase whitespace-nowrap">
                        Serial
                      </th>
                      <th className="border border-blue-400/40 dark:border-blue-300/20 px-2 sm:px-3 py-2 text-[11px] sm:text-xs uppercase whitespace-nowrap">
                        ID
                      </th>
                      <th className="border border-blue-400/40 dark:border-blue-300/20 px-2 sm:px-3 py-2 text-[11px] sm:text-xs uppercase whitespace-nowrap">
                        Name
                      </th>

                      {co.orderedProducts.map((p) => (
                        <th
                          key={p}
                          title={p}
                          className="border border-blue-400/40 dark:border-blue-300/20 px-2 sm:px-3 py-2 text-[11px] sm:text-xs uppercase whitespace-nowrap"
                        >
                          {shortName(p)}
                        </th>
                      ))}

                      <th
                        className="border border-blue-400/40 dark:border-blue-300/20 px-2 sm:px-3 py-2 text-[11px] sm:text-xs uppercase cursor-pointer select-none whitespace-nowrap"
                        onClick={() => setSortDesc((v) => !v)}
                        aria-sort={sortDesc ? "descending" : "ascending"}
                      >
                        <div className="flex items-center gap-1">
                          Total{" "}
                          {sortDesc ? (
                            <FiArrowDown size={14} />
                          ) : (
                            <FiArrowUp size={14} />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRows.map((row, idx) => (
                      <tr
                        key={`${row._id}-${idx}`}
                        className="hover:bg-gray-50 dark:hover:bg-neutral-800"
                      >
                        <td className="border border-gray-200 dark:border-neutral-800 px-2 sm:px-3 py-2 min-w-[40px] font-semibold text-gray-900 dark:text-neutral-100 text-center">
                          {idx + 1}
                        </td>

                        <td className="border border-gray-200 dark:border-neutral-800 px-2 sm:px-3 py-2 min-w-[80px] font-mono text-gray-900 dark:text-neutral-100 break-all">
                          {row.employeeId || "-"}
                        </td>

                        <td className="border border-gray-200 dark:border-neutral-800 px-2 sm:px-3 py-2 min-w-[160px] font-semibold text-gray-900 dark:text-neutral-100">
                          {data?.isAdmin && row._id !== "null" ? (
                            <Link
                              href={`/dashboard/admin/employee/${row._id}/screenshots?days=30`}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline break-words"
                            >
                              {row.name || "Unknown"}
                            </Link>
                          ) : (
                            <span className="break-words">
                              {row.name || "Unknown"}
                            </span>
                          )}
                        </td>

                        {co.orderedProducts.map((p) => {
                          const count = row.products[p] || 0;
                          const badge =
                            count === 0
                              ? "bg-gray-200 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                              : count < 3
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : count < 6
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
                          return (
                            <td
                              key={`${row._id}-${p}`}
                              className="px-2 sm:px-3 py-2 border border-gray-200 dark:border-neutral-800 text-center align-middle"
                            >
                              <span
                                className={clsx(
                                  "inline-block text-[11px] sm:text-xs font-semibold px-2 py-1 rounded-full",
                                  badge
                                )}
                              >
                                {count}
                              </span>
                            </td>
                          );
                        })}

                        <td className="border border-gray-200 dark:border-neutral-800 px-2 sm:px-3 py-2 min-w-[80px] font-bold text-indigo-700 dark:text-indigo-300 text-center">
                          <span className="bg-indigo-50 dark:bg-indigo-900/30 px-2.5 sm:px-3 py-1 rounded-full inline-block">
                            {row.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot className="bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold text-gray-700 dark:text-neutral-200">
                    <tr>
                      <td className="px-2 sm:px-4 py-3" colSpan={3}>
                        Total
                      </td>

                      {co.orderedProducts.map((p) => (
                        <td key={p} className="px-2 sm:px-3 py-3 text-center">
                          <span className="inline-block text-[11px] sm:text-[13px] px-2.5 py-1 rounded-full bg-neutral-200 text-gray-700 dark:bg-neutral-700 dark:text-neutral-200">
                            {co.columnTotals[p] || 0}
                          </span>
                        </td>
                      ))}

                      <td className="px-2 sm:px-4 py-3 font-bold text-green-700 dark:text-green-300 text-center">
                        <span className="bg-green-50 dark:bg-green-900/30 px-2.5 sm:px-3 py-1 rounded-full inline-block">
                          {sortedRows.reduce((sum, r) => sum + r.total, 0)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
