"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  Filter,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  Link as LinkIcon,
  Eye,
  X,
} from "lucide-react";

/* ======================== Types ======================== */
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
  address?: string;
  post_link?: string;
  lead_status: LeadStatus;
  workingDay: string;
  createdAt?: string;
  submitted_by?: string;
  assigned_to?: string | null;
  rent?: string;
};

type ListResponse = {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  data: LeadRow[];
};

type LeadDetails = {
  _id: string;
  fb_id_name?: string;
  client_name?: string;
  number?: string;
  rent?: string;
  house_apt?: string;
  house_apt_details?: string;
  address?: string;
  post_link?: string;
  screenshot_link?: string;
  signup_screenshot_link?: string;
  lead_status: LeadStatus;
  submitted_by?: { name?: string; email?: string; employeeId?: string } | null;
  assigned_to?: { name?: string; email?: string; employeeId?: string } | null;
  assigned_at?: string;
  workingDay: string;
  sourceCompanyId?: string | null;
  targetCompanyId?: string | null;
  assignedCompanyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_OPTIONS: (LeadStatus | "all")[] = [
  "all",
  "pending",
  "assigned",
  "approved",
  "rejected",
];
const LIMIT_OPTIONS = [10, 25, 50, 100, 200];

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ======================== Hooks ======================== */
function useDebounced<T>(value: T, delay = 450) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ======================== UI Helpers ======================== */
function StatusBadge({ value }: { value: LeadStatus }) {
  const label = value.replace("_", " ");
  const cls =
    value === "approved"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/60"
      : value === "rejected"
      ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/60"
      : value === "in_progress"
      ? "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/60"
      : value === "assigned"
      ? "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/60"
      : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/60";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-slate-200 dark:border-slate-700/60">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
        </td>
      ))}
    </tr>
  );
}

/* ======================== Details Modal ======================== */
function DetailsModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const open = Boolean(id);
  const { data, error, isLoading } = useSWR<{ data: LeadDetails }>(
    open ? `/api/admin/leads/${id}` : null,
    fetcher
  );

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lead = data?.data;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative mx-2 mb-2 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl transition-all dark:border-slate-700 dark:bg-slate-900 sm:mx-4 sm:mb-0">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Lead Details
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Full information with quick links
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4 sm:p-5">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700/60"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              Failed to load details.
            </div>
          )}

          {!isLoading && !error && lead && (
            <div className="space-y-6">
              {/* Top meta */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={lead.lead_status} />
                <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {lead.workingDay}
                </span>
                {lead.createdAt && (
                  <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Created: {new Date(lead.createdAt).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Grid info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client">{lead.client_name || "-"}</Field>
                <Field label="FB ID">{lead.fb_id_name || "-"}</Field>
                <Field label="Phone">{lead.number || "-"}</Field>
                <Field label="Rent">{lead.rent || "-"}</Field>
                <Field label="House/Apt">{lead.house_apt || "-"}</Field>
                <Field label="House/Apt Details">
                  {lead.house_apt_details || "-"}
                </Field>
                <Field label="Submitted By">
                  {lead.submitted_by?.name
                    ? `${lead.submitted_by.name} (${
                        lead.submitted_by.employeeId || "-"
                      })`
                    : "-"}
                </Field>
                <Field label="Assigned To">
                  {lead.assigned_to?.name
                    ? `${lead.assigned_to.name} (${
                        lead.assigned_to.employeeId || "-"
                      })`
                    : "-"}
                </Field>
                <Field label="Assigned At">
                  {lead.assigned_at
                    ? new Date(lead.assigned_at).toLocaleString()
                    : "-"}
                </Field>
                <Field label="Address" full>
                  {lead.address || "-"}
                </Field>
              </div>

              {/* Links */}
              <div className="grid gap-3 sm:grid-cols-2">
                <LinkField label="Post Link" href={lead.post_link} />
                <LinkField
                  label="Signup Screenshot"
                  href={lead.signup_screenshot_link}
                />
                <LinkField
                  label="General Screenshot"
                  href={lead.screenshot_link}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

function LinkField({ label, href }: { label: string; href?: string }) {
  const valid = href && /^https?:\/\//i.test(href);
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1">
        {valid ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <LinkIcon className="h-4 w-4" />
            Open link
          </a>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Not provided
          </span>
        )}
      </div>
    </div>
  );
}

/* ======================== Page ======================== */
export default function AdminAllLeadsPage() {
  // filters
  const [workingDay, setWorkingDay] = useState<string>("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [search, setSearch] = useState<string>("");

  const dSearch = useDebounced(search, 500);

  // modal state
  const [openId, setOpenId] = useState<string | null>(null);

  // working days
  const { data: wdData, error: wdErr } = useSWR<{ workingDays: string[] }>(
    `/api/admin/leads/working-days`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // list data
  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (workingDay) sp.set("workingDay", workingDay);
    if (status && status !== "all") sp.set("status", status);
    if (dSearch) sp.set("search", dSearch.trim());
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    sp.set("sort", "-createdAt");
    return sp.toString();
  }, [workingDay, status, dSearch, page, limit]);

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/admin/leads?${qs}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  // when filters change → reset page
  useEffect(() => {
    setPage(1);
  }, [workingDay, status, dSearch, limit]);

  const total = data?.total || 0;
  const canPrev = page > 1;
  const canNext = data?.hasMore ?? false;
  const pageStartIndex = (data?.page ?? page) - 1;
  const rowOffset = pageStartIndex * (data?.limit ?? limit);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Title + Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100">
            All Leads
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Paginated, filterable, and theme-aware list for superadmin/admin.
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-750"
          title="Refresh"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filter Card */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-5 md:p-5">
          {/* Working Day */}
          <div className="flex flex-col">
            <label className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <CalendarDays className="h-4 w-4" />
              Working Day
            </label>
            <select
              aria-label="Working Day"
              value={workingDay}
              onChange={(e) => setWorkingDay(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400"
            >
              <option value="">All Days</option>
              {(wdData?.workingDays || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {wdErr && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-rose-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Failed to load days
              </span>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <label className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Filter className="h-4 w-4" />
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={[
                      "rounded-lg border px-2.5 py-1.5 text-xs transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 dark:hover:bg-slate-700",
                    ].join(" ")}
                  >
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <label className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Search className="h-4 w-4" />
              Search (name / fb / phone / address)
            </label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
                aria-label="Search"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            </div>
          </div>

          {/* Page Size */}
          <div className="flex flex-col">
            <label className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <FileText className="h-4 w-4" />
              Page Size
            </label>
            <select
              aria-label="Page Size"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
            <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm dark:bg-slate-800/80">
              <tr className="border-b border-slate-200 dark:border-slate-700/60">
                <Th>#</Th>
                <Th>Client</Th>
                <Th>FB ID</Th>
                <Th>Phone</Th>
                <Th>Rent</Th>
                <Th>Address</Th>
                <Th>Status</Th>
                <Th>Working Day</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!isLoading && error && (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <div className="flex items-center justify-center gap-2 text-rose-500">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="text-sm">Failed to load leads.</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !error && (data?.data || []).length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10">
                    <div className="text-center">
                      <div className="mx-auto mb-2 h-10 w-10 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No leads found for selected filters.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {(data?.data || []).map((r, idx) => {
                const serial = rowOffset + idx + 1;
                const postOk = r.post_link && /^https?:\/\//i.test(r.post_link);
                return (
                  <tr
                    key={r._id}
                    className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/60"
                  >
                    <Td className="font-medium">{serial}</Td>
                    <Td className="font-medium">{r.client_name || "-"}</Td>
                    <Td className="truncate">{r.fb_id_name || "-"}</Td>
                    <Td className="whitespace-nowrap">{r.number || "-"}</Td>
                    <Td className="whitespace-nowrap">{r.rent || "-"}</Td>
                    <Td className="max-w-[340px] truncate">
                      {r.address || "-"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <StatusBadge value={r.lead_status} />
                    </Td>
                    <Td className="whitespace-nowrap">{r.workingDay}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {postOk && (
                          <a
                            href={r.post_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            title="Open post"
                          >
                            <LinkIcon className="h-4 w-4" />
                            Post
                          </a>
                        )}
                        <button
                          onClick={() => setOpenId(r._id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
          <div>
            {total > 0
              ? `Showing ${(data!.page - 1) * data!.limit + 1}-${Math.min(
                  data!.page * data!.limit,
                  total
                )} of ${total}`
              : "No results"}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev}
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm enabled:hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:bg-slate-750"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <div className="tabular-nums">Page {data?.page || page}</div>
            <button
              disabled={!canNext}
              onClick={() => canNext && setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm enabled:hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:bg-slate-750"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <DetailsModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/* ======================== Tiny subcomponents ======================== */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 ${className}`}
    >
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
    <td
      className={`px-3 py-2 align-middle text-slate-700 dark:text-slate-200 ${className}`}
    >
      {children}
    </td>
  );
}
