"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FiSearch,
  FiRefreshCw,
  FiTrash2,
  FiEdit3,
  FiUsers,
  FiShield,
  FiCheck,
  FiX,
} from "react-icons/fi";

type MembershipView = {
  companyId: string;
  companyCode?: string | null;
  companyName?: string | null;
  roleMode: "uploader" | "receiver" | "hybrid";
  role:
    | "superadmin"
    | "admin"
    | "lead_operator"
    | "fb_submitter"
    | "fb_analytics_viewer";
  active: boolean;
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
};

type AppSession = {
  user?: { name?: string | null; email?: string | null };
  userId?: string;
  role?: MembershipView["role"];
  memberships?: MembershipView[];
};

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  employeeId?: string;
  isActive?: boolean;
  role?: MembershipView["role"];
  memberships?: Array<{
    companyId: string;
    role: MembershipView["role"];
  }>;
  lastLoginAt?: string | null;
  lastKnownIP?: string | null;
  createdAt?: string;
};

type UsersEnvelope = { users: UserRow[] };

// —— helper: safe error message extraction (no-any) ——
function getErrorMessage(err: unknown, fallback = "Operation failed"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}
// lightweight type guards
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function apiErrorOf(v: unknown): string | null {
  return isObj(v) && typeof v.error === "string" ? v.error : null;
}
export default function AdminUsersPage() {
  const { data } = useSession();
  const session = (data || {}) as AppSession;

  const companies = useMemo(
    () =>
      (session.memberships || [])
        .filter((m) => m.active !== false)
        .map((m) => ({
          id: m.companyId,
          label: m.companyName || m.companyCode || m.companyId,
        })),
    [session.memberships]
  );

  const singleCompanyId =
    companies.length === 1 ? companies[0].id : undefined;

  const [companyId, setCompanyId] = useState<string>(
    singleCompanyId || companies[0]?.id || ""
  );

  useEffect(() => {
    if (singleCompanyId) setCompanyId(singleCompanyId);
  }, [singleCompanyId]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string>("");

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Password modal
  const [pwdForId, setPwdForId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  const canSwitchCompany = companies.length > 1;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (companyId) qs.set("companyId", companyId);

     const resp = await fetch(`/api/users?${qs.toString()}`, { cache: "no-store" });

const payload: unknown = await resp.json();
if (!resp.ok) {
  throw new Error(apiErrorOf(payload) ?? "Failed to load");
}

const list: UserRow[] = Array.isArray(payload)
  ? (payload as UserRow[])
  : ((payload as UsersEnvelope).users ?? []);

setUsers(list);

    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, companyId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
    const resp = await fetch(`/api/users?id=${deleteId}`, { method: "DELETE" });
const payload: unknown = await resp.json().catch(() => ({}));
if (!resp.ok) {
  throw new Error(apiErrorOf(payload) ?? "Delete failed");
}

      setDeleteId(null);
      await fetchUsers();
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Delete failed"));
    } finally {
      setDeleting(false);
    }
  };

  const onSavePassword = async () => {
    if (!pwdForId) return;
    if (newPassword.trim().length < 6) {
      setPwdErr("Password must be at least 6 characters.");
      return;
    }
    setPwdSaving(true);
    setPwdErr("");
    try {
    const resp = await fetch(`/api/users?id=${pwdForId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: newPassword }),
});
const payload: unknown = await resp.json().catch(() => ({}));
if (!resp.ok) {
  throw new Error(apiErrorOf(payload) ?? "Update failed");
}

      setPwdForId(null);
      setNewPassword("");
    } catch (e: unknown) {
      setPwdErr(getErrorMessage(e, "Update failed"));
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <FiUsers className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            User Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Company switch (only if multiple) */}
          {canSwitchCompany ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="h-9 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select company"
              title="Select company"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
              <FiShield /> {companies[0]?.label || "My Company"}
            </span>
          )}

          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, ID…"
              className="h-9 w-56 md:w-72 rounded-md pl-8 pr-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchUsers}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <FiRefreshCw />
            Refresh
          </button>

          <Link
            href="/dashboard/admin/employees/new"
            className="inline-flex h-9 items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 text-sm"
          >
            + New User
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 dark:bg-slate-800/70 text-left text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Employee ID</Th>
              <Th>Role</Th>
              <Th>Last Login</Th>
              <Th>Last Ip</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <RowSkeleton rows={8} cols={6} />
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-slate-600 dark:text-slate-300"
                >
                  {error ? `Error: ${error}` : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u._id}
                  className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                >
                  <Td className="font-medium text-slate-900 dark:text-slate-100">
                    {u.name || "—"}
                  </Td>
                  <Td className="font-mono">{u.email || "—"}</Td>
                  <Td className="font-mono">{u.employeeId || "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(u.memberships || []).map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 h-6 inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                          title={m.companyId}
                        >
                          {m.role}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString()
                      : "—"}
                  </Td>
                  <Td>{u.lastKnownIP ? u.lastKnownIP : "—"}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setPwdForId(u._id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 px-2 h-8 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Edit password"
                      >
                        <FiEdit3 /> Password
                      </button>
                      <button
                        onClick={() => setDeleteId(u._id)}
                        className="inline-flex items-center gap-1 rounded border border-red-300 dark:border-red-800 px-2 h-8 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Delete user"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)} title="Delete User">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Are you sure you want to delete this user? This action cannot be
            undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <FiX /> Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-70"
            >
              <FiTrash2 />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Password modal */}
      {pwdForId && (
        <Modal onClose={() => setPwdForId(null)} title="Set New Password">
          <div className="space-y-2">
            <label className="block text-sm text-slate-700 dark:text-slate-300">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-10 rounded-md px-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a strong password"
            />
            {pwdErr && (
              <p className="text-xs text-red-600 dark:text-red-400">{pwdErr}</p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setPwdForId(null)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <FiX /> Cancel
            </button>
            <button
              onClick={onSavePassword}
              disabled={pwdSaving}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-70"
            >
              <FiCheck />
              {pwdSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------- UI bits ----------------- */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

function RowSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-slate-200 dark:border-slate-800">
          {Array.from({ length: cols + 1 }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
