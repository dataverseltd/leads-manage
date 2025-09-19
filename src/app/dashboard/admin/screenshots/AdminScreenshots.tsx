// D:\DataVerse\lead-suite\apps\web\src\app\dashboard\admin\screenshots\AdminScreenshots.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  Fragment,
} from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import Image from "next/image";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiCalendar,
  FiFilter,
  FiImage,
  FiSearch,
  FiZoomIn,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
} from "react-icons/fi";

import { useScreenshotRT, type ScreenshotEvent } from "@/hooks/useScreenshotRT";
import { getWorkingDayBD } from "@/lib/getWorkingDay";

/* ------------------- Types ------------------- */
type Row = {
  _id: string;
  url: string;
  productId: string;
  productName: string;
  productMonth: string;
  workingDay: string;
  uploadedAt: string; // normalized string
  uploadedBy?: string | null; // user id
  companyId?: string | null;
  reviewed: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

type ScreenshotEvt = ScreenshotEvent & {
  uploadedAt: string | Date;
  reviewedAt?: string | Date | null;
};

type UploaderMini = { _id: string; name?: string; employeeId?: string | null };
type UploaderMap = Record<string, UploaderMini>;

/* ------------------- Config & Fetcher ------------------- */
const ADMIN_LIST_API = `/api/admin/screenshots`;
const REVIEW_API = `/api/admin/screenshots/review`;

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

/* ------------------- Small utils ------------------- */
function timeAgo(input: string | number | Date) {
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const toRow = (p: ScreenshotEvt): Row => ({
  _id: p._id,
  url: p.url,
  productId: p.productId,
  productName: p.productName,
  productMonth: p.productMonth,
  workingDay: p.workingDay,
  uploadedBy: p.uploadedBy ?? null,
  companyId: p.companyId ?? null,
  reviewed: p.reviewed,
  uploadedAt: String(p.uploadedAt),
  reviewedAt: p.reviewedAt != null ? String(p.reviewedAt) : null,
  reviewedBy: p.reviewedBy ?? null,
});

/* ------------------- Component ------------------- */
export default function AdminScreenshots({ companyId }: { companyId: string }) {
  const [workingDay, setWorkingDay] = useState<string>(getWorkingDayBD());
  const [q, setQ] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [onlyUnreviewed, setOnlyUnreviewed] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const statusForServer = onlyUnreviewed ? "unreviewed" : "all";
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (workingDay) p.set("workingDay", workingDay);
    if (statusForServer !== "all") p.set("status", statusForServer);
    if (q.trim()) p.set("q", q.trim());
    p.set("limit", "500");
    return p.toString();
  }, [workingDay, statusForServer, q]);

  const { data, mutate, isLoading } = useSWR<Row[]>(
    `${ADMIN_LIST_API}?${qs}`,
    fetcher,
    { keepPreviousData: true }
  );

  const [items, setItems] = useState<Row[]>([]);
  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const refresh = useCallback(() => {
    startTransition(() => {
      mutate();
    });
  }, [mutate]);

  const markReviewed = useCallback(async (id: string, reviewed: boolean) => {
    try {
      const r = await fetch(REVIEW_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, reviewed }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success(reviewed ? "Marked reviewed" : "Mark removed");
      setItems((prev): Row[] =>
        prev.map((x) =>
          x._id === id
            ? {
                ...x,
                reviewed,
                reviewedAt: reviewed ? new Date().toISOString() : null,
              }
            : x
        )
      );
    } catch {
      toast.error("Review update failed");
    }
  }, []);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const onUploaded = useCallback(
    (p: ScreenshotEvent) => {
      const evt = p as ScreenshotEvt;
      const passDay = !workingDay || evt.workingDay === workingDay;
      const passProduct =
        productFilter === "all" || evt.productName === productFilter;
      const passUnreviewed = !onlyUnreviewed || !evt.reviewed;

      if (passDay && passProduct && passUnreviewed) {
        setItems((prev): Row[] => {
          const next = [toRow(evt), ...prev];
          const seen = new Set<string>();
          return next.filter((r) =>
            seen.has(r._id) ? false : (seen.add(r._id), true)
          );
        });
      }
      toast.success(`New screenshot: ${evt.productName}`);
    },
    [workingDay, productFilter, onlyUnreviewed]
  );

  const onReviewed = useCallback((p: ScreenshotEvent) => {
    const evt = p as ScreenshotEvt;
    setItems((prev): Row[] =>
      prev.map((x) =>
        x._id === evt._id
          ? {
              ...x,
              reviewed: evt.reviewed,
              reviewedAt: evt.reviewedAt ? String(evt.reviewedAt) : null,
              reviewedBy: evt.reviewedBy ?? null,
            }
          : x
      )
    );
  }, []);

  useScreenshotRT({ companyId, workingDay, onUploaded, onReviewed });

  /* ---------- NEW: fetch uploader metadata for headers ---------- */

  const uploaderIds = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => {
      if (it.uploadedBy) s.add(String(it.uploadedBy));
    });
    return Array.from(s).sort();
  }, [items]);

  const { data: uploaderMap } = useSWR<UploaderMap | undefined>(
    uploaderIds.length ? ["uploader-mini", uploaderIds.join(",")] : null,
    async () => {
      // POST ids to our proxy; expect { users: UploaderMini[] }
      const res = await postJson<{ users: UploaderMini[] }>(
        "/api/admin/users/mini",
        { ids: uploaderIds }
      );
      const map: UploaderMap = {};
      for (const u of res.users) {
        map[u._id] = u;
      }
      return map;
    }
  );

  /* ------------------- Derivations for the UI ------------------- */

  const uniqueProducts = useMemo(() => {
    const s = new Set<string>();
    items.forEach((x) => s.add(x.productName));
    return Array.from(s).sort();
  }, [items]);

  const totals = useMemo(() => {
    const total = items.length;
    const unreviewed = items.filter((x) => !x.reviewed).length;
    return { total, unreviewed };
  }, [items]);

  const term = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (productFilter !== "all" && s.productName !== productFilter)
        return false;

      if (!term) return true;

      const uploaderId = (s.uploadedBy ?? "").toString().toLowerCase();
      const meta = s.uploadedBy
        ? uploaderMap?.[String(s.uploadedBy)]
        : undefined;
      const name = (meta?.name ?? "").toLowerCase();
      const emp = (meta?.employeeId ?? "").toLowerCase();

      return (
        s.productName.toLowerCase().includes(term) ||
        uploaderId.includes(term) ||
        name.includes(term) ||
        emp.includes(term)
      );
    });
  }, [items, productFilter, term, uploaderMap]);

  // Group by uploadedBy with friendly header
  const grouped: Array<{
    key: string; // uploader id or "unknown"
    display: string; // "Name — 359273" or "Unknown"
    shots: Row[];
  }> = useMemo(() => {
    const buckets = new Map<string, Row[]>();
    for (const s of filtered) {
      const key = s.uploadedBy ?? "unknown";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(s);
    }
    // sort each bucket by time desc
    for (const arr of buckets.values()) {
      arr.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    }
    // build display label using uploaderMap
    const out: Array<{ key: string; display: string; shots: Row[] }> = [];
    for (const [key, shots] of buckets.entries()) {
      const meta = key !== "unknown" ? uploaderMap?.[key] : undefined;
      const label = meta
        ? `${meta.name ?? key}${meta.employeeId ? ` — ${meta.employeeId}` : ""}`
        : key === "unknown"
        ? "Unknown"
        : key; // fallback to id
      out.push({ key, display: label, shots });
    }
    // Rank by bucket size desc
    out.sort((a, b) => b.shots.length - a.shots.length);
    return out;
  }, [filtered, uploaderMap]);

  /* ------------------- Render ------------------- */
  return (
    <div className="p-6">
      {/* Top Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        {/* Left: Day picker + stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-600 dark:text-gray-300" />
            <input
              type="date"
              value={workingDay}
              onChange={(e) => setWorkingDay(e.target.value)}
              className="border rounded px-3 py-2 text-sm
                     bg-white dark:bg-neutral-900
                     text-gray-900 dark:text-neutral-100
                     border-gray-200 dark:border-neutral-700
                     placeholder:text-gray-400 dark:placeholder:text-neutral-500
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-flex items-center gap-1 rounded-full
                         bg-indigo-50 text-indigo-700
                         dark:bg-indigo-900/40 dark:text-indigo-300
                         px-2.5 py-1 font-semibold"
            >
              <FiImage /> {totals.total} total
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full
                         bg-amber-50 text-amber-700
                         dark:bg-amber-900/30 dark:text-amber-300
                         px-2.5 py-1 font-semibold"
            >
              <FiXCircle /> {totals.unreviewed} unreviewed
            </span>
          </div>
        </div>

        {/* Right: Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative text-sm">
            <FiSearch className="pointer-events-none absolute left-2 top-2.5 text-gray-400 dark:text-gray-500" />
            <input
              type="search"
              placeholder="Search product / name / employee id…"
              className="pl-8 pr-3 py-2 border rounded w-64
                     bg-white dark:bg-neutral-900
                     text-gray-900 dark:text-neutral-100
                     border-gray-200 dark:border-neutral-700
                     placeholder:text-gray-400 dark:placeholder:text-neutral-500
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-500 dark:text-gray-400" />
            <select
              className="border rounded px-3 py-2 text-sm
                     bg-white dark:bg-neutral-900
                     text-gray-900 dark:text-neutral-100
                     border-gray-200 dark:border-neutral-700
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="all">All products</option>
              {uniqueProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <label className="ml-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={onlyUnreviewed}
                onChange={(e) => setOnlyUnreviewed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-neutral-600
                       bg-white dark:bg-neutral-900
                       text-[var(--brand-600)] focus:ring-[var(--brand-600)]"
              />
              Show only unreviewed
            </label>

            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 px-3 py-2 rounded
                     border border-gray-200 dark:border-neutral-700
                     bg-white hover:bg-gray-50
                     dark:bg-neutral-900 dark:hover:bg-neutral-800
                     text-gray-800 dark:text-gray-100 ml-2"
              title="Refresh"
            >
              <FiRefreshCw />
              {isPending || isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-gray-200 dark:bg-neutral-800 animate-pulse"
            />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div
          className="rounded-lg border border-gray-200 dark:border-neutral-800
                    bg-white dark:bg-neutral-900
                    p-10 text-center
                    text-gray-600 dark:text-gray-300"
        >
          No screenshots found.
        </div>
      ) : (
        grouped.map(({ key, display, shots }) => (
          <div key={key} className="mb-10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {display}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {shots.length} item{shots.length > 1 ? "s" : ""}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {shots.map((s) => (
                <div
                  key={s._id}
                  className="border rounded-lg p-2 shadow-sm hover:shadow transition
                         bg-white dark:bg-neutral-900
                         border-gray-200 dark:border-neutral-800"
                >
                  <div className="relative group">
                    <Image
                      src={s.url}
                      alt={s.productName}
                      width={300}
                      height={200}
                      className="w-full h-40 object-contain rounded cursor-pointer
                             bg-white dark:bg-neutral-950"
                      onClick={() => setZoomedImage(s.url)}
                    />
                    <button
                      className="absolute top-2 right-2 text-white bg-black/50 p-1 rounded
                             opacity-0 group-hover:opacity-100 transition"
                      onClick={() => setZoomedImage(s.url)}
                      title="Zoom"
                    >
                      <FiZoomIn size={16} />
                    </button>

                    {/* status pill */}
                    <div className="absolute bottom-2 left-2">
                      {s.reviewed ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold
                                     rounded-full bg-green-50 text-green-700
                                     dark:bg-green-900/30 dark:text-green-300
                                     px-2 py-0.5"
                        >
                          <FiCheckCircle /> Reviewed
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold
                                     rounded-full bg-amber-50 text-amber-700
                                     dark:bg-amber-900/30 dark:text-amber-300
                                     px-2 py-0.5"
                        >
                          <FiXCircle /> Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                      {s.productName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.productMonth} • {s.productId.slice(-6)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.workingDay} • {timeAgo(s.uploadedAt)}
                    </p>

                    <div className="pt-2 flex items-center gap-3">
                      {s.reviewed ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 text-xs
                                 text-green-700 dark:text-green-300"
                          title="Already reviewed"
                        >
                          <FiCheckCircle /> Done
                        </button>
                      ) : (
                        <button
                          onClick={() => markReviewed(s._id, true)}
                          title="Mark as reviewed"
                          className="inline-flex items-center gap-1 text-sm
                                 text-gray-700 hover:text-indigo-600
                                 dark:text-gray-300 dark:hover:text-indigo-400 transition"
                        >
                          Review
                        </button>
                      )}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm
                               text-indigo-600 hover:underline
                               dark:text-indigo-400"
                        title="Open original"
                      >
                        <FiImage /> Open
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Zoom Modal */}
      <Transition show={!!zoomedImage} as={Fragment}>
        <Dialog onClose={() => setZoomedImage(null)} className="relative z-50">
          <Transition.Child
            enter="transition-opacity ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              className="relative max-w-5xl w-full max-h-[90vh]
                                  bg-white dark:bg-neutral-900
                                  text-gray-900 dark:text-neutral-100
                                  p-4 rounded shadow-lg overflow-auto"
            >
              {zoomedImage && (
                <Image
                  src={zoomedImage}
                  alt="Zoomed"
                  width={1600}
                  height={1000}
                  className="w-full object-contain"
                />
              )}
              <button
                className="absolute top-2 right-2 bg-indigo-600 text-white px-3 py-1 rounded text-sm
                       hover:brightness-95"
                onClick={() => setZoomedImage(null)}
              >
                Close
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
