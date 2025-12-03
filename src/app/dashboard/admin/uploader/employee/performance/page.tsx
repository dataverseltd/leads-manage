"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiUsers, FiChevronRight, FiRefreshCw } from "react-icons/fi";

type Company = {
  _id: string;
  name: string;
  code: string;
  active: boolean;
  roleMode: "uploader" | "receiver" | "hybrid" | string;
};

type EmployeePerf = {
  userId: string;
  name: string;
  employee_id: string;
  role?: string;
  weekly: number;
  monthly: number;
  yearly: number;
};

type PerfResponse = {
  company: { _id: string; name: string; code: string } | null;
  range: {
    weeklyStart: string;
    weeklyEnd: string;
    month: string;
    year: number;
  } | null;
  employees: EmployeePerf[];
};

export default function UploaderEmployeePerformancePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [data, setData] = useState<PerfResponse | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [error, setError] = useState("");

  /* -------------------------------------------------------
   * 1) Load ONLY user's membership companies (not all!)
   * ----------------------------------------------------- */
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true);

        const resp = await fetch("/api/admin/companies?scope=memberships");
        if (!resp.ok) {
          setCompanies([]);
          return;
        }

        const list = (await resp.json()) as Company[];

        // Filter only uploader/hybrid companies
        const filtered = list.filter(
          (c) => c.roleMode === "uploader" || c.roleMode === "hybrid"
        );

        setCompanies(filtered);

        // If no memberships at all -> show nothing
        if (filtered.length === 0) {
          setCompanyId("");
          return;
        }

        // Auto-select when only one
        if (filtered.length === 1) {
          setCompanyId(filtered[0]._id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCompanies(false);
      }
    };

    loadCompanies();
  }, []);

  /* -------------------------------------------------------
   * 2) Load Performance by companyId
   * ----------------------------------------------------- */
  const loadPerformance = async (cid: string) => {
    if (!cid) return;
    try {
      setLoadingPerf(true);
      setError("");

      const resp = await fetch(
        `/api/admin/uploader/employee/performance?companyId=${cid}`
      );

      if (!resp.ok) {
        setError(`Failed to load performance (${resp.status})`);
        setData(null);
        return;
      }

      const json = (await resp.json()) as PerfResponse;

      // Filter ONLY lead_operator employees
      json.employees = json.employees.filter((e) => e.role === "lead_operator");

      setData(json);
    } catch (err) {
      console.error(err);
      setError("Network error");
    } finally {
      setLoadingPerf(false);
    }
  };

  useEffect(() => {
    if (companyId) loadPerformance(companyId);
  }, [companyId]);

  const employees = data?.employees || [];

  /* -------------------------------------------------------
   * SUPERADMIN OR USER WITH NO MEMBERSHIPS
   * ----------------------------------------------------- */
  if (!loadingCompanies && companies.length === 0) {
    return (
      <div className="p-6 text-center text-slate-600 dark:text-slate-300">
        No company membership found.
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-[#f9f8ff] to-[#fbfcff] dark:from-[#05080f3f] dark:to-[#17214179]">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiUsers className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Uploader Employee Performance
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Weekly / Monthly / Yearly uploads by workingDay, per employee.
          </p>

          {data?.range && (
            <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
              Weekly: {data.range.weeklyStart} → {data.range.weeklyEnd} ·
              Monthly: {data.range.month} · Year: {data.range.year}
            </p>
          )}
        </div>

        {/* Company Selector: only when multiple */}
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 1 && (
            <div>
              <label
                htmlFor="company"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Company
              </label>
              <select
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-9 min-w-[220px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Auto-selected single membership */}
          {companies.length === 1 && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {companies[0].name} ({companies[0].code})
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => companyId && loadPerformance(companyId)}
            disabled={loadingPerf || !companyId}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 rounded-md border border-red-200/70 dark:border-red-800 bg-red-50/70 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Placeholder When No Company Selected */}
      {!companyId && !loadingCompanies && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Select a company to view uploader performance.
        </div>
      )}

      {/* Loading Placeholder */}
      {companyId && loadingPerf && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* CARDS (same UI you provided) */}
      {companyId && !loadingPerf && employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map((emp) => (
            <Link
              key={emp.userId}
              href={`/dashboard/admin/uploader/employee/${emp.employee_id}?companyId=${companyId}`}
              className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow px-4 py-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {emp.name || "Unknown"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ID: {emp.employee_id}
                    </div>
                  </div>
                  <FiChevronRight className="text-slate-400 group-hover:text-blue-500 transition" />
                </div>

                <div className="mt-2 space-y-1 text-[13px]">
                  <div>
                    <span className="font-medium text-emerald-600">
                      Weekly:
                    </span>{" "}
                    {emp.weekly} leads
                  </div>
                  <div>
                    <span className="font-medium text-blue-600">Monthly:</span>{" "}
                    {emp.monthly} leads
                  </div>
                  <div>
                    <span className="font-medium text-amber-600">Yearly:</span>{" "}
                    {emp.yearly} leads
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* No employees */}
      {companyId && !loadingPerf && employees.length === 0 && !error && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          No lead operators found for this company.
        </div>
      )}
    </div>
  );
}
