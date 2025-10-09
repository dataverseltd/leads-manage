"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  ArrowRightLeft,
  Loader2,
  Users,
  UserCircle2,
  CheckCircle2,
  RefreshCcw,
  Building2,
  Lock,
  AlertTriangle,
} from "lucide-react";

type Operator = {
  _id: string;
  name: string;
  employeeId?: string;
  assignedCount: number;
};

type Company = {
  _id: string;
  name: string;
  code: string;
  roleMode: "uploader" | "receiver" | "hybrid";
};

type ApiError = { error?: string };
type TransferResponse = { transferred?: number; success?: boolean; error?: string };

export default function LeadTransferPage() {
  const { data: session } = useSession();

  const [operators, setOperators] = useState<Operator[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [fromUser, setFromUser] = useState<string>("");
  const [toUser, setToUser] = useState<string>("");
  const [transferring, setTransferring] = useState<boolean>(false);
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(true);

  // Modal state
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  /* ---------------- Fetch Receiver Companies ---------------- */
  const fetchCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const res = await fetch(`/api/admin/companies?active=1&scope=memberships`);
      const data: Company[] = await res.json();
      const receiver = data.filter((c) =>
        ["receiver", "hybrid"].includes(c.roleMode)
      );
      setCompanies(receiver);
      if (receiver.length === 1) setCompanyId(receiver[0]._id);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load companies");
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  /* ---------------- Fetch Operators ---------------- */
  const fetchOperators = useCallback(
    async (selectedCompanyId?: string) => {
      const cid = selectedCompanyId || companyId;
      if (!cid) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/lead-transfer?companyId=${cid}`);
        const data: { operators?: Operator[] } & ApiError = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load operators");
        setOperators(data.operators || []);
      } catch (error) {
        console.error(error);
        toast.error("Error fetching operators");
      } finally {
        setLoading(false);
      }
    },
    [companyId]
  );

  /* ---------------- Transfer Action ---------------- */
  const confirmTransfer = async () => {
    setShowConfirm(false);
    if (!fromUser || !toUser) return;

    try {
      setTransferring(true);
      const res = await fetch(`/api/admin/lead-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: fromUser,
          toUserId: toUser,
          companyId,
        }),
      });

      const data: TransferResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");

      toast.success(`Transferred ${data.transferred || 0} leads successfully`);
      await fetchOperators();
      setFromUser("");
      setToUser("");
    } catch (error) {
      console.error(error);
      toast.error("Transfer error");
    } finally {
      setTransferring(false);
    }
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    if (companyId) fetchOperators(companyId);
  }, [companyId, fetchOperators]);

  /* ---------------- UI ---------------- */
  const fromOp = operators.find((o) => o._id === fromUser);
  const toOp = operators.find((o) => o._id === toUser);

  return (
    <div className="p-4 sm:p-6 space-y-6 relative">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--brand-600)]" />
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Lead Transfer Between Operators
          </h1>
        </div>

        {!loading && (
          <button
            onClick={() => fetchOperators()}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-[var(--brand-600)] transition"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        )}
      </header>

      {/* ---------- Company Selector ---------- */}
      <section className="rounded-xl border bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-sm p-4 sm:p-6">
        {loadingCompanies ? (
          <div className="flex justify-center items-center py-6 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading companies...
          </div>
        ) : companies.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-6">
            You don’t have access to any receiver companies.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Building2 className="w-5 h-5 text-[var(--brand-600)] shrink-0" />
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  fetchOperators(e.target.value);
                }}
                disabled={companies.length === 1}
                className="Input !h-10"
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.roleMode})
                  </option>
                ))}
              </select>
            </div>
            {companies.length === 1 && (
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
                <Lock className="w-4 h-4" /> Locked
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- Operators + Transfer ---------- */}
      <section className="rounded-xl border bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-sm p-4 sm:p-6 space-y-5">
        {loading ? (
          <div className="flex justify-center items-center py-8 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading operators...
          </div>
        ) : operators.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No lead operators found for this company.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  From Operator
                </label>
                <select
                  value={fromUser}
                  onChange={(e) => setFromUser(e.target.value)}
                  className="Input mt-1"
                >
                  <option value="">Select Operator</option>
                  {operators.map((op) => (
                    <option key={op._id} value={op._id}>
                      {op.name} ({op.employeeId}) — {op.assignedCount} assigned
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  To Operator
                </label>
                <select
                  value={toUser}
                  onChange={(e) => setToUser(e.target.value)}
                  className="Input mt-1"
                >
                  <option value="">Select Operator</option>
                  {operators.map((op) => (
                    <option key={op._id} value={op._id}>
                      {op.name} ({op.employeeId}) — {op.assignedCount} assigned
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <button
                disabled={transferring || !fromUser || !toUser}
                onClick={() => setShowConfirm(true)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium shadow transition ${
                  transferring || !fromUser || !toUser
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[var(--brand-600)] hover:bg-[var(--brand-700)]"
                }`}
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer Assigned Leads
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---------- Operator Summary ---------- */}
      {!loading && operators.length > 0 && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {operators.map((op) => (
            <div
              key={op._id}
              className="flex items-center gap-3 bg-white/80 dark:bg-zinc-900/60 border rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition"
            >
              <UserCircle2 className="w-6 h-6 text-[var(--brand-600)]" />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="font-medium truncate">{op.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  ID: {op.employeeId}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-sm">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-600)]" />
                <span>{op.assignedCount}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---------- Confirmation Modal ---------- */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-xl max-w-md w-full mx-4 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Confirm Lead Transfer</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              Are you sure you want to transfer all <b>assigned</b> leads from{" "}
              <span className="font-medium text-[var(--brand-600)]">
                {fromOp?.name || "Operator A"} ({fromOp?.employeeId})
              </span>{" "}
              to{" "}
              <span className="font-medium text-[var(--brand-600)]">
                {toOp?.name || "Operator B"} ({toOp?.employeeId})
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransfer}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] transition"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
