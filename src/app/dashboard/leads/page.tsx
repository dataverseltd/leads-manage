"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Filter,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  FileText,
} from "lucide-react";

type LeadStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "approved"
  | "rejected";

type LeadRow = {
  _id: string;
  fb_id_name?: string;
  client_name?: string;
  number?: string;
  rent?: string | number;
  house_apt?: string;
  house_apt_details?: string;
  address?: string;
  post_link?: string;
  lead_status: LeadStatus;
  workingDay: string;
  createdAt?: string;
};

type ApiResponse = {
  items: LeadRow[];
  page: number;
  pageSize: number;
  total: number;
  workingDays?: string[];
};
type ErrorResponse = { error: string };

const LIMIT = 20;

const STATUS_OPTIONS: { label: string; value: "" | LeadStatus }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function statusPill(s: LeadStatus) {
  switch (s) {
    case "approved":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30";
    case "assigned":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30";
    case "in_progress":
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30";
    case "rejected":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30";
    case "pending":
    default:
      return "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30";
  }
}

function SkeletonRow() {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 w-full max-w-[140px] animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </td>
      ))}
    </tr>
  );
}

export default function UploaderLeadsPage() {
  // server session is used in API; page itself doesn’t need useSession()
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"" | LeadStatus>("");
  const [workingDay, setWorkingDay] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(LIMIT),
      });
      if (status) params.set("status", status);
      if (workingDay) params.set("workingDay", workingDay);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(
        `/api/leads/uploader/leads?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      // parse once
      const json = await res.json();

      // handle error early and exit
      if (!res.ok) {
        const errMsg =
          (json as { error?: string })?.error ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      // success: now it's safe to treat as ApiResponse
      const data = json as ApiResponse;

      setRows(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(
        Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || LIMIT)))
      );
      setWorkingDays(data.workingDays || []);
      setLoadedOnce(true);
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, workingDay]);

  const fromIdx = useMemo(
    () => (total === 0 ? 0 : (page - 1) * LIMIT + 1),
    [page, total]
  );
  const toIdx = useMemo(() => Math.min(page * LIMIT, total), [page, total]);

  const onSearchChange = (v: string) => {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load();
    }, 400);
  };

  const resetAll = () => {
    setQ("");
    setStatus("");
    setWorkingDay("");
    setPage(1);
    load();
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            My Uploaded Leads
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Server-filtered & paginated • {LIMIT} per page
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {total > 0 && (
            <span>
              Showing <strong>{fromIdx}</strong>–<strong>{toIdx}</strong> of{" "}
              <strong>{total}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className="mb-5 rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur
                   border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="flex flex-col md:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <Search size={14} /> Search (name/number/address/link)
            </label>
            <input
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Type to search…"
              className="rounded-lg border bg-white px-3 py-2 text-sm
                         border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500
                         dark:bg-zinc-950 dark:border-zinc-700 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <Filter size={14} /> Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | LeadStatus);
                setPage(1);
              }}
              className="rounded-lg border bg-white px-3 py-2 text-sm
                         border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500
                         dark:bg-zinc-950 dark:border-zinc-700 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.label} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <CalendarDays size={14} /> Working Day
            </label>
            <select
              value={workingDay}
              onChange={(e) => {
                setWorkingDay(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border bg-white px-3 py-2 text-sm
                         border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500
                         dark:bg-zinc-950 dark:border-zinc-700 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            >
              <option value="">All</option>
              {workingDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setPage(1);
                load();
              }}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2
                         bg-indigo-600 text-white hover:bg-indigo-700
                         dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Filter size={16} /> Apply
            </button>
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 border
                         border-zinc-300 hover:bg-zinc-50
                         dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-100"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div
        className="hidden overflow-auto rounded-2xl border bg-white shadow-sm md:block
                   border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <table className="w-full min-w-[1100px] text-sm">
          <thead
            className="sticky top-0 z-10 bg-zinc-50/90 text-zinc-700 backdrop-blur
                            dark:bg-zinc-800/80 dark:text-zinc-200"
          >
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">FB ID</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Number</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Working Day</th>
              <th className="p-3 text-left">Post</th>
              <th className="p-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              !loadedOnce &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading &&
              rows.map((lead, idx) => (
                <motion.tr
                  key={lead._id}
                  className="border-t border-zinc-200 transition hover:bg-indigo-50/40
                           dark:border-zinc-800 dark:hover:bg-indigo-500/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <td className="p-3 font-medium text-zinc-800 dark:text-zinc-100">
                    {(page - 1) * LIMIT + idx + 1}
                  </td>
                  <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {lead.fb_id_name || "—"}
                  </td>
                  <td className="p-3 text-zinc-700 dark:text-zinc-300">
                    {lead.client_name || "—"}
                  </td>
                  <td className="p-3 text-zinc-700 dark:text-zinc-300">
                    {lead.number || "—"}
                  </td>
                  <td className="p-3 text-zinc-600 dark:text-zinc-400">
                    {lead.address || "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={clsx(
                        "text-xs px-2 py-1 rounded-full font-semibold ring-1",
                        statusPill(lead.lead_status)
                      )}
                    >
                      {lead.lead_status}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-indigo-700 dark:text-indigo-300">
                    {lead.workingDay || "—"}
                  </td>
                  <td className="p-3">
                    {lead.post_link ? (
                      <a
                        href={lead.post_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 underline
                                 dark:text-indigo-300"
                      >
                        <LinkIcon size={14} /> View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {lead.createdAt
                      ? new Date(lead.createdAt).toLocaleString()
                      : "—"}
                  </td>
                </motion.tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10">
                  <div className="flex flex-col items-center text-zinc-500 dark:text-zinc-400">
                    <FileText className="mb-2 h-10 w-10" />
                    <p className="text-base">
                      No leads found for the selected filters.
                    </p>
                    <p className="mt-1 text-xs">
                      Try adjusting working day or search.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {loading &&
          !loadedOnce &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 shadow-sm
                                    border-zinc-200 bg-white
                                    dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}

        {!loading &&
          rows.map((lead, idx) => (
            <div
              key={lead._id}
              className="rounded-2xl border p-4 shadow-sm
                                         border-zinc-200 bg-white
                                         dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  #{(page - 1) * LIMIT + idx + 1}
                </span>
                <span
                  className={clsx(
                    "text-[11px] px-2 py-0.5 rounded-full font-semibold ring-1",
                    statusPill(lead.lead_status)
                  )}
                >
                  {lead.lead_status}
                </span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                {lead.fb_id_name || "—"}
              </div>
              <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {lead.client_name || "—"} · {lead.number || "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {lead.address || "—"}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {lead.workingDay || "—"}
                </span>
                {lead.post_link ? (
                  <a
                    href={lead.post_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 underline dark:text-indigo-300"
                  >
                    <LinkIcon size={14} /> View
                  </a>
                ) : (
                  <span className="text-zinc-400">No Post</span>
                )}
              </div>
            </div>
          ))}

        {!loading && rows.length === 0 && (
          <div
            className="rounded-2xl border p-6 text-center shadow-sm
                          border-zinc-200 bg-white text-zinc-500
                          dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
          >
            No leads found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 border",
            "border-zinc-300 hover:bg-zinc-50 text-zinc-900 bg-white",
            "dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-100 dark:bg-zinc-900",
            (page <= 1 || loading) && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 border",
            "border-zinc-300 hover:bg-zinc-50 text-zinc-900 bg-white",
            "dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-100 dark:bg-zinc-900",
            (page >= totalPages || loading) && "opacity-50 cursor-not-allowed"
          )}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
