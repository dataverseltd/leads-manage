"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2, LineChart, Users } from "lucide-react";
import { useMemo } from "react";

type BoardKind =
  | "uploader-leaderboard"
  | "receiver-performance"
  | "fb-analytics"
  | "none";

export default function ClientTopbar(props: {
  memberships: {
    companyId: string;
    role: string;
    canUploadLeads: boolean;
    canReceiveLeads: boolean;
  }[];
  activeCompanyId: string;
  role: string;
  currentKind: BoardKind;
  showUploaderTab: boolean;
  showReceiverTab: boolean;
}) {
  const {
    memberships,
    activeCompanyId,
    role,
    currentKind,
    showUploaderTab,
    showReceiverTab,
  } = props;
  const router = useRouter();
  const sp = useSearchParams();

  const companies = useMemo(
    () =>
      memberships.map((m) => ({
        id: m.companyId,
        label: `Company ${m.companyId.slice(-4)}`,
      })),
    [memberships]
  );

  function update(param: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp as any);
    Object.entries(param).forEach(([k, v]) =>
      !v ? params.delete(k) : params.set(k, v)
    );
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* Company switcher */}
      <div className="inline-flex items-center gap-2">
        <div className="h-10 w-10 rounded-xl bg-[var(--brand-600)]/10 border border-[var(--brand-600)]/20 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-[var(--brand-700)] dark:text-[var(--brand-400)]" />
        </div>
        <select
          className="h-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 backdrop-blur px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
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

      {/* Admin/Superadmin view tabs */}
      {(role === "admin" || role === "superadmin") && (
        <div className="inline-flex rounded-xl border border-gray-300/70 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 backdrop-blur overflow-hidden shadow-sm">
          {showUploaderTab && (
            <button
              onClick={() => update({ view: "uploader-leaderboard" })}
              className={[
                "px-4 py-2 text-sm flex items-center gap-2 transition",
                currentKind === "uploader-leaderboard"
                  ? "bg-[var(--brand-600)] text-white"
                  : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200",
              ].join(" ")}
              title="Uploaders"
            >
              <Users className="h-4 w-4" />
              Uploaders
            </button>
          )}
          {showReceiverTab && (
            <button
              onClick={() => update({ view: "receiver-performance" })}
              className={[
                "px-4 py-2 text-sm flex items-center gap-2 border-l border-gray-300/70 dark:border-zinc-700 transition",
                currentKind === "receiver-performance"
                  ? "bg-[var(--brand-600)] text-white"
                  : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200",
              ].join(" ")}
              title="Receivers"
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
