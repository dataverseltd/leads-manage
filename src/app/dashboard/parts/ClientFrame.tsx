"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2, LineChart, Users } from "lucide-react";
import { useMemo } from "react";

type BoardKind =
  | "uploader-leaderboard"
  | "receiver-performance"
  | "fb-analytics"
  | "none";

export default function ClientFrame(props: {
  memberships: {
    companyId: string;
    role: string;
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
  }[];
  activeCompanyId: string;
  showUploaderTab: boolean;
  showReceiverTab: boolean;
  role: string;
  currentKind: BoardKind;
}) {
  const {
    memberships,
    activeCompanyId,
    showUploaderTab,
    showReceiverTab,
    role,
    currentKind,
  } = props;
  const router = useRouter();
  const sp = useSearchParams();

  const companies = useMemo(
    () =>
      memberships.map((m) => ({
        id: m.companyId,
        label: shortId(m.companyId),
      })),
    [memberships]
  );

  function shortId(id: string) {
    return `Company ${id.slice(-4)}`;
  }

  function update(param: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp as any);
    Object.entries(param).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      {/* Company switcher */}
      <div className="inline-flex items-center gap-2">
        <Building2 className="h-5 w-5 text-gray-500" />
        <select
          className="h-10 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
          value={activeCompanyId}
          onChange={(e) => update({ company: e.target.value })}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* View tabs for admin/superadmin only */}
      {(role === "admin" || role === "superadmin") && (
        <div className="ml-2 inline-flex rounded-lg border border-gray-300 dark:border-zinc-700 overflow-hidden">
          {showUploaderTab && (
            <button
              onClick={() => update({ view: "uploader-leaderboard" })}
              className={[
                "px-3 py-2 text-sm flex items-center gap-1",
                currentKind === "uploader-leaderboard"
                  ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                  : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300",
              ].join(" ")}
              title="Uploader Leaderboard"
            >
              <Users className="h-4 w-4" />
              Uploaders
            </button>
          )}
          {showReceiverTab && (
            <button
              onClick={() => update({ view: "receiver-performance" })}
              className={[
                "px-3 py-2 text-sm border-l border-gray-300 dark:border-zinc-700 flex items-center gap-1",
                currentKind === "receiver-performance"
                  ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                  : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300",
              ].join(" ")}
              title="Receiver Performance"
            >
              <LineChart className="h-4 w-4" />
              Receivers
            </button>
          )}
        </div>
      )}
    </div>
  );
}
