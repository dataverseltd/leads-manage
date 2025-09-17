// ./src/app/dashboard/my-leads/MyLeadsClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { FiSearch, FiX, FiCopy } from "react-icons/fi";
import {
  User as LuUser,
  Phone as LuPhone,
  Home as LuHome,
  MapPin as LuMapPin,
  CheckCircle2 as LuCheckCircle2,
  XCircle as LuXCircle,
  Link as LuLink,
  Calendar as LuCalendar,
  Signal as LuSignal,
  SignalHigh as LuSignalHigh,
} from "lucide-react";
import Ably from "ably";
import type { Message } from "ably";
import io from "socket.io-client";
import Image from "next/image";
import { getRealtime } from "@/lib/ablyClient";
import { useProducts } from "@/hooks/useProducts";
import { UploadModal } from "@/components/leads/UploadModal";

function useSystemThemeSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
}

type Lead = {
  _id: string;
  assigned_to: string | { _id: string };
  client_name: string;
  number: string;
  fb_id_name: string;
  lead_status: "assigned" | "approved" | "rejected";
  workingDay: string;
  rent?: string;
  house_apt?: string;
  house_apt_details?: string;
  address?: string;
  post_link?: string;
  createdAt: string;
};

type SsItem = {
  product: string;
  count: number;
  distinctLeads: number;
  firstUploadAt: string;
  lastUploadAt: string;
  recentUrls: string[];
};

type SsResp = {
  workingDay: string;
  total: number;
  distinctLeads: number;
  items: SsItem[];
};

type AblyRealtime = Ably.Realtime;
type RealtimeChannel = ReturnType<AblyRealtime["channels"]["get"]>;

const PAGE_SIZE = 30;

export default function MyLeadsClient({
  userId,
  name: _name, // unused → underscore to satisfy no-unused-vars
  role: _role,
  caps: _caps,
  activeCompanyId,
}: {
  userId: string;
  name: string;
  role: string;
  caps: Record<string, boolean>;
  activeCompanyId?: string;
}) {
  useSystemThemeSync();

  const [connectionSource, setConnectionSource] = useState<
    "ably" | "socket" | "polling" | null
  >(null);
  const didInitDay = useRef(false);

  const [days, setDays] = useState<string[]>([]);
  const [activeDay, setActiveDay] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "" | "assigned" | "approved" | "rejected"
  >("");

  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const [selected, setSelected] = useState<Lead | null>(null);

  const [byLeadCount, setByLeadCount] = useState<Record<string, number>>({});
  const { products } = useProducts(activeCompanyId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<Lead | null>(null);

  const [screenshotSummary, setScreenshotSummary] = useState<SsItem[]>([]);
  const [screenshotTotals, setScreenshotTotals] = useState<{
    total: number;
    distinctLeads: number;
  } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadDays = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/leads/days", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load days:", res.status, text);
        setDays([]);
        return;
      }
      const d: string[] = await res.json();
      const uniqDesc = Array.from(new Set(d)).sort((a, b) => (a < b ? 1 : -1));
      setDays(uniqDesc);
      if (!didInitDay.current) {
        setActiveDay(uniqDesc[0] ?? "");
        didInitDay.current = true;
      }
    } catch (e) {
      console.error("Days request error:", e);
      setDays([]);
    }
  }, []);

  const fetchPage = useCallback(
    async (page: number, replace = false) => {
      setLoading(true);
      try {
        const p = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (activeDay) p.set("workingDay", activeDay);
        if (query.trim()) p.set("q", query.trim());
        if (status) p.set("status", status);

        const url = `/api/employee/leads?${p.toString()}`;
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Leads load failed:", res.status, text);
          throw new Error(text || "Failed to load leads");
        }

        const data: {
          items: Lead[];
          hasMore: boolean;
          byLeadShotCount?: Record<string, number>;
        } = await res.json();

        setRows((prev) => (replace ? data.items : [...prev, ...data.items]));
        setHasMore(data.hasMore);
        if (data.byLeadShotCount)
          setByLeadCount((prev) => ({ ...prev, ...data.byLeadShotCount }));
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "An unknown error occurred";
        console.error(e);
        toast.error(msg || "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [activeDay, query, status]
  );

  const resetAndFetch = useCallback(() => {
    pageRef.current = 1;
    setRows([]);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage]);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    const t = setTimeout(() => resetAndFetch(), 200);
    return () => clearTimeout(t);
  }, [activeDay, status, query, resetAndFetch]); // ✅ includes resetAndFetch

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const next = pageRef.current + 1;
          pageRef.current = next;
          fetchPage(next);
        }
      },
      { rootMargin: "800px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, activeDay, status, query, fetchPage]); // ✅ includes fetchPage

  // Realtime: leads + screenshots
  useEffect(() => {
    if (!userId) return;

    let socket: ReturnType<typeof io> | null = null;
    let ably: Ably.Realtime | null = null;
    let chCompany: RealtimeChannel | null = null;
    let chShotCompany: RealtimeChannel | null = null;
    let chShotGlobal: RealtimeChannel | null = null;
    let chGlobalLead: RealtimeChannel | null = null;
    let polling: ReturnType<typeof setInterval> | null = null;

    const companyChannel = activeCompanyId
      ? `company:${activeCompanyId}:leads`
      : null;
    const shotCompanyChannel = activeCompanyId
      ? `company:${activeCompanyId}:screenshots`
      : null;
    const globalLeadChannel = "leads:new";
    const globalShotChannel = "screenshots:new";

    const getIdString = (v: unknown) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "_id" in v) {
        const id = (v as { _id?: unknown })._id;
        return typeof id === "string" ? id : String(id ?? "");
      }
      return String(v ?? "");
    };

    type RTLead = {
      _id: string;
      assigned_to: string | { _id: string };
      workingDay: string;
    } & Partial<Lead>;

    const onLead = (lead: RTLead) => {
      if (getIdString(lead.assigned_to) !== String(userId)) return;
      if (activeDay && lead.workingDay !== activeDay) return;
      setRows((prev) =>
        prev.some((x) => x._id === lead._id) ? prev : [lead as Lead, ...prev]
      );
      toast.success("New lead assigned to you");
    };

    const onScreenshot = (payload: { leadId: string; workingDay: string }) => {
      const { leadId, workingDay } = payload || {};
      if (activeDay && workingDay !== activeDay) return;
      setByLeadCount((prev) => ({
        ...prev,
        [leadId]: (prev[leadId] || 0) + 1,
      }));
      toast.success("New screenshot uploaded");
    };

    const startPolling = () => {
      if (polling) return;
      setConnectionSource((src) => src ?? "polling");
      polling = setInterval(() => fetchPage(1, true), 30000);
    };

    // Socket.IO
    {
      const url = (
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000"
      ).trim();
      socket = io(url, {
        transports: ["websocket"],
        path: "/socket.io",
        auth: { companyId: activeCompanyId || "" },
      });

      socket.on("connect", () =>
        setConnectionSource((src) => (src ? src : "socket"))
      );
      socket.on("lead:new", onLead);
      socket.on("screenshot:new", onScreenshot);
      socket.on("disconnect", startPolling);
    }

    // Ably
    {
      if (activeCompanyId) ably = getRealtime(activeCompanyId);
      else if (process.env.NEXT_PUBLIC_ABLY_KEY)
        ably = new Ably.Realtime({
          key: process.env.NEXT_PUBLIC_ABLY_KEY,
          echoMessages: false,
        });

      if (ably) {
        ably.connection.on("connected", () => {
          setConnectionSource((src) =>
            src === "socket" ? "ably" : src ?? "ably"
          );
          if (companyChannel) {
            chCompany = ably!.channels.get(companyChannel);
            chCompany.subscribe("lead", (msg: Message) =>
              onLead(msg.data as RTLead)
            );
          }
          chGlobalLead = ably!.channels.get(globalLeadChannel);
          chGlobalLead.subscribe("lead", (msg: Message) =>
            onLead(msg.data as RTLead)
          );

          if (shotCompanyChannel) {
            chShotCompany = ably!.channels.get(shotCompanyChannel);
            chShotCompany.subscribe("screenshot", (msg: Message) =>
              onScreenshot(msg.data as { leadId: string; workingDay: string })
            );
          }
          chShotGlobal = ably!.channels.get(globalShotChannel);
          chShotGlobal.subscribe("screenshot", (msg: Message) =>
            onScreenshot(msg.data as { leadId: string; workingDay: string })
          );
        });

        ably.connection.on("failed", startPolling);
        ably.connection.on("closed", startPolling);
      } else {
        startPolling();
      }
    }

    return () => {
      socket?.off("lead:new", onLead);
      socket?.off("screenshot:new", onScreenshot);
      socket?.disconnect();

      chCompany?.unsubscribe?.();
      chShotCompany?.unsubscribe?.();
      chShotGlobal?.unsubscribe?.();
      chGlobalLead?.unsubscribe?.();
      ably?.close?.();

      if (polling) clearInterval(polling);
    };
  }, [userId, activeCompanyId, activeDay, fetchPage]);

  // Status update
  const updateStatus = async (id: string, next: "approved" | "rejected") => {
    setRows((prev) =>
      prev.map((x) => (x._id === id ? { ...x, lead_status: next } : x))
    );
    const res = fetch("/api/employee/leads/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    if ((await res).ok) toast.success(`Lead marked as ${next}`);
    else toast.error("Failed to update status");
    setSelected(null);
  };

  // uploads
  const openUploadFor = (lead: Lead) => {
    setUploadTarget(lead);
    setUploadOpen(true);
  };

  const reloadShots = async (leadId: string) => {
    setByLeadCount((prev) => ({ ...prev, [leadId]: (prev[leadId] || 0) + 1 }));
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((x) => x.lead_status === "approved").length;
    const rejected = rows.filter((x) => x.lead_status === "rejected").length;
    const assigned = total - approved - rejected;
    return { total, approved, rejected, assigned };
  }, [rows]);

  // screenshot summary for the active day
  async function fetchScreenshotSummary(day: string) {
    const r = await fetch(
      `/api/employee/screenshots/summary?workingDay=${encodeURIComponent(day)}`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );
    const data = (await r.json()) as SsResp;
    if (!r.ok)
      throw new Error(
        (data as unknown as { error?: string })?.error ||
          "Failed to load SS summary"
      );
    setScreenshotSummary(data.items);
    setScreenshotTotals({
      total: data.total,
      distinctLeads: data.distinctLeads,
    });
  }

  useEffect(() => {
    if (!activeDay) {
      setScreenshotSummary([]);
      setScreenshotTotals(null);
      return;
    }
    fetchScreenshotSummary(activeDay).catch(() => {
      setScreenshotSummary([]);
      setScreenshotTotals(null);
    });
  }, [activeDay]);

  const handleUploaded = (workingDay: string) => {
    if (activeDay && workingDay === activeDay) {
      fetchScreenshotSummary(activeDay).catch(() => {});
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            My Assigned Leads
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Connection:
            </span>
            {connectionSource ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                {connectionSource === "ably" ? (
                  <LuSignal size={14} />
                ) : (
                  <LuSignalHigh size={14} />
                )}
                <span className="capitalize">{connectionSource}</span>
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">—</span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:auto-cols-max sm:grid-flow-col gap-2">
          <select
            value={activeDay}
            onChange={(e) => setActiveDay(e.target.value)}
            className="border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Days</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as "" | "assigned" | "approved" | "rejected"
              )
            } // ✅ no `any`
            className="border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="assigned">Assigned</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" />
            <input
              placeholder="Search number or address…"
              className="pl-9 pr-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {activeDay && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-blue-700 dark:text-blue-300 text-sm">Approved</p>
            <p className="text-xl font-semibold text-blue-900 dark:text-blue-200">
              {summary.approved}
            </p>
          </div>
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              Assigned
            </p>
            <p className="text-xl font-semibold text-yellow-900 dark:text-yellow-200">
              {summary.assigned}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/20 p-4">
            <p className="text-rose-700 dark:text-rose-300 text-sm">Rejected</p>
            <p className="text-xl font-semibold text-rose-900 dark:text-rose-200">
              {summary.rejected}
            </p>
          </div>
        </div>
      )}

      {/* SS Summary header */}
      {activeDay && (
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            My Screenshots on <span className="font-medium">{activeDay}</span>:
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200/70">
            Total: <strong>{screenshotTotals?.total ?? "—"}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 border border-indigo-200/70">
            Distinct Leads:{" "}
            <strong>{screenshotTotals?.distinctLeads ?? "—"}</strong>
          </span>
        </div>
      )}

      {/* SS Summary grid */}
      {activeDay && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
          {screenshotSummary.map((item) => (
            <div
              key={item.product}
              className="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 shadow-sm"
              title={`First: ${new Date(
                item.firstUploadAt
              ).toLocaleTimeString()} • Last: ${new Date(
                item.lastUploadAt
              ).toLocaleTimeString()}`}
            >
              <p className="text-gray-700 dark:text-gray-300 mb-1 font-medium truncate">
                {item.product}
              </p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {item.count}
              </p>

              {!!item.recentUrls?.length && (
                <div className="mt-2 flex -space-x-2">
                  {item.recentUrls.slice(0, 3).map((u) => (
                    <Image
                      key={u}
                      src={u}
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded border border-white dark:border-neutral-900 object-cover"
                    />
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Leads: {item.distinctLeads}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="relative w-full overflow-x-auto rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow">
        <div className="min-w-[1100px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-gray-300 uppercase text-xs border-b border-gray-200 dark:border-neutral-800">
              <tr>
                {[
                  "#",
                  "Client",
                  "FB ID",
                  "Address",
                  "Rent",
                  "Number",
                  "Signup SS",
                  "Status",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
              <AnimatePresence initial={false}>
                {rows.map((lead, idx) => (
                  <motion.tr
                    key={lead._id}
                    layout
                    initial={{ opacity: 0, translateY: 6 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setSelected(lead)}
                    className={
                      lead.lead_status === "assigned"
                        ? "bg-amber-50/40 dark:bg-amber-900/10"
                        : "hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                    }
                  >
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <LuUser
                          size={16}
                          className="text-gray-400 dark:text-gray-500"
                        />
                        <span className="font-medium">{lead.client_name}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              lead.client_name || ""
                            );
                            toast.success("Client copied");
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          title="Copy"
                          aria-label="Copy client"
                        >
                          <FiCopy />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {lead.fb_id_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <LuMapPin
                          size={16}
                          className="text-gray-400 dark:text-gray-500"
                        />
                        <span className="truncate max-w-[360px]">
                          {lead.address}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lead.address || "");
                            toast.success("Address copied");
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          title="Copy"
                          aria-label="Copy address"
                        >
                          <FiCopy />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {lead.rent || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <LuPhone
                          size={16}
                          className="text-gray-400 dark:text-gray-500"
                        />
                        <span>{lead.number}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lead.number || "");
                            toast.success("Number copied");
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          title="Copy"
                          aria-label="Copy number"
                        >
                          <FiCopy />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openUploadFor(lead);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                        >
                          Upload
                        </button>
                        {byLeadCount[lead._id] ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {byLeadCount[lead._id]} uploaded
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold capitalize",
                          lead.lead_status === "assigned" &&
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
                          lead.lead_status === "approved" &&
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
                          lead.lead_status === "rejected" &&
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {lead.lead_status === "assigned" && (
                          <LuUser size={14} />
                        )}
                        {lead.lead_status === "approved" && (
                          <LuCheckCircle2 size={14} />
                        )}
                        {lead.lead_status === "rejected" && (
                          <LuXCircle size={14} />
                        )}
                        {lead.lead_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(lead)}
                        className="text-sm text-gray-700 dark:text-gray-200 underline hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Details
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={`skc-${i}-${j}`} className="px-4 py-4">
                        <div className="h-4 rounded bg-gray-200 dark:bg-neutral-800" />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div ref={sentinelRef} />

      {/* Details Modal */}
      <Transition appear show={!!selected} as={"div"}>
        <Dialog onClose={() => setSelected(null)} className="relative z-50">
          <Transition.Child
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
              >
                <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      Lead Details
                    </Dialog.Title>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400"
                      aria-label="Close"
                    >
                      <FiX size={20} />
                    </button>
                  </div>

                  {selected && (
                    <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <LuUser
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>Client:</strong>
                        <span>{selected.client_name}</span>
                        <button
                          title="Copy"
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              selected.client_name || ""
                            )
                          }
                        >
                          <FiCopy />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuPhone
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>Number:</strong>
                        <span>{selected.number}</span>
                        <button
                          title="Copy"
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          onClick={() =>
                            navigator.clipboard.writeText(selected.number || "")
                          }
                        >
                          <FiCopy />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuUser
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>FB ID:</strong>
                        <span>{selected.fb_id_name}</span>
                        <button
                          title="Copy"
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              selected.fb_id_name || ""
                            )
                          }
                        >
                          <FiCopy />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuCalendar
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>Working Day:</strong>
                        <span>{selected.workingDay}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuHome
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>Apartment:</strong>
                        <span>
                          {selected.house_apt} — {selected.house_apt_details}
                        </span>
                        <button
                          title="Copy"
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${selected.house_apt || ""} — ${
                                selected.house_apt_details || ""
                              }`
                            )
                          }
                        >
                          <FiCopy />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuMapPin
                          className="text-gray-500 dark:text-gray-400"
                          size={16}
                        />
                        <strong>Address:</strong>
                        <span className="truncate">{selected.address}</span>
                        <button
                          title="Copy"
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              selected.address || ""
                            )
                          }
                        >
                          <FiCopy />
                        </button>
                      </div>

                      {selected.post_link && (
                        <div className="flex items-center gap-2">
                          <LuLink
                            className="text-gray-500 dark:text-gray-400"
                            size={16}
                          />
                          <strong>Post:</strong>
                          <a
                            href={
                              selected.post_link.startsWith("http")
                                ? selected.post_link
                                : `https://${selected.post_link}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 underline"
                          >
                            Facebook Post
                          </a>
                        </div>
                      )}

                      {selected.lead_status === "assigned" && (
                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            onClick={() =>
                              updateStatus(selected._id, "rejected")
                            }
                            className="px-4 py-2 text-sm rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() =>
                              updateStatus(selected._id, "approved")
                            }
                            className="px-4 py-2 text-sm rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                          >
                            Mark as Done
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Upload Modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        leadId={uploadTarget?._id || null}
        products={products}
        reloadShots={reloadShots}
        onUploaded={handleUploaded}
        activeDay={activeDay}
      />
    </div>
  );
}
