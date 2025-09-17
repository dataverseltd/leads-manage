"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  PlayCircle,
  PauseCircle,
  Users2,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Mail,
  KeyRound,
  Building2,
} from "lucide-react";

type DistStatus = { on: boolean };

type Employee = {
  _id: string;
  name: string;
  email: string;
  employeeId?: string;
  isActive?: boolean;
  role?:
    | "superadmin"
    | "admin"
    | "lead_operator"
    | "fb_submitter"
    | "fb_analytics_viewer";
  memberships?: Array<{
    companyId: string;
    role: Employee["role"];
    canUploadLeads?: boolean;
    canReceiveLeads?: boolean;
    can_distribute_leads?: boolean;
    can_distribute_fbids?: boolean;
    can_create_user?: boolean;
    lastReceivedAt?: string | null;
  }>;
};

export default function AdminControlCenter() {
  const { data: session } = useSession();
  const [dist, setDist] = useState<DistStatus | null>(null);
  const [loadingDist, setLoadingDist] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin =
    (session as any)?.role === "superadmin" ||
    (session as any)?.role === "admin";

  // ---- Distribution controls ----
  async function refreshStatus() {
    const res = await fetch("/api/admin/distribution/status", {
      cache: "no-store",
    });
    const j = await res.json();
    setDist(j);
  }
  async function toggleDist(on: boolean) {
    setLoadingDist(true);
    await fetch(`/api/admin/distribution/${on ? "start" : "stop"}`, {
      method: "POST",
    });
    await refreshStatus();
    setLoadingDist(false);
  }

  // ---- Employees load / actions ----
  async function loadEmployees() {
    setLoadingUsers(true);
    const res = await fetch(
      `/api/admin/users?search=${encodeURIComponent(q)}`,
      { cache: "no-store" }
    );
    const j = await res.json();
    setEmployees(j.users || []);
    setLoadingUsers(false);
  }

  async function updateEmployeeCaps(userId: string, patch: Partial<Employee>) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadEmployees();
  }

  useEffect(() => {
    refreshStatus();
  }, []);
  useEffect(() => {
    const t = setTimeout(loadEmployees, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        You don’t have access to the Admin Control Center.
      </div>
    );
  }

  return (
    <section className="relative p-6 max-w-7xl mx-auto">
      {/* top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-140px] h-[260px] bg-[radial-gradient(900px_180px_at_50%_-40px,rgba(16,146,152,0.20),transparent)] dark:bg-[radial-gradient(900px_180px_at_50%_-40px,rgba(16,146,152,0.12),transparent)]"
      />

      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Admin Control Center
        </h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Start/stop lead distribution and manage employees across companies.
        </p>
      </header>

      {/* Grid: Distribution + Quick Create */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-[var(--brand-600)]" />
            <h2 className="font-semibold">Distribution</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mb-4">
            Control global distribution. When on, new leads are assigned
            immediately; when off, they stay pending.
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-sm ${
                  dist?.on ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {dist?.on ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {dist?.on ? "Active" : "Paused"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={loadingDist || dist?.on}
                onClick={() => toggleDist(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-600)] px-3 py-2 text-white text-sm shadow-sm disabled:opacity-60"
              >
                {loadingDist && dist?.on !== true ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Start
              </button>
              <button
                disabled={loadingDist || !dist?.on}
                onClick={() => toggleDist(false)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
              >
                {loadingDist && dist?.on === true ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4" />
                )}
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-[var(--brand-600)]" />
              <h2 className="font-semibold">Employees</h2>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-600)] px-3 py-2 text-white text-sm shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Employee
            </button>
          </div>

          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / email / employee ID…"
              className="w-full h-10 rounded-xl border bg-white/80 dark:bg-zinc-900/60 backdrop-blur pl-9 pr-3 text-sm border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]"
            />
          </div>
        </div>
      </div>

      {/* Employees table */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600 dark:text-zinc-300">
              <tr>
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Employee ID</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Receive</th>
                <th className="py-2 px-3">Upload</th>
                <th className="py-2 px-3">Distribute</th>
                <th className="py-2 px-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr>
                  <td className="py-8 px-3" colSpan={8}>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td className="py-8 px-3 text-gray-500" colSpan={8}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((u) => {
                  // surface the first membership to display caps inline (simple)
                  const m = u.memberships?.[0];
                  return (
                    <tr
                      key={u._id}
                      className="border-t border-gray-100 dark:border-zinc-800"
                    >
                      <td className="py-3 px-3">{u.name}</td>
                      <td className="py-3 px-3">{u.email}</td>
                      <td className="py-3 px-3">{u.employeeId || "-"}</td>
                      <td className="py-3 px-3">
                        <select
                          value={u.role || m?.role || "lead_operator"}
                          onChange={(e) =>
                            updateEmployeeCaps(u._id, {
                              role: e.target.value as any,
                            })
                          }
                          className="h-8 rounded-md border bg-transparent px-2"
                        >
                          <option value="superadmin">superadmin</option>
                          <option value="admin">admin</option>
                          <option value="lead_operator">lead_operator</option>
                          <option value="fb_submitter">fb_submitter</option>
                          <option value="fb_analytics_viewer">
                            fb_analytics_viewer
                          </option>
                        </select>
                      </td>

                      <td className="py-3 px-3">
                        <Toggle
                          checked={!!m?.canReceiveLeads || false}
                          onChange={(v) =>
                            updateEmployeeCaps(u._id, {
                              memberships: [
                                { ...(m || {}), canReceiveLeads: v },
                              ],
                            })
                          }
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Toggle
                          checked={!!m?.canUploadLeads || false}
                          onChange={(v) =>
                            updateEmployeeCaps(u._id, {
                              memberships: [
                                { ...(m || {}), canUploadLeads: v },
                              ],
                            })
                          }
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Toggle
                          checked={!!m?.can_distribute_leads || false}
                          onChange={(v) =>
                            updateEmployeeCaps(u._id, {
                              memberships: [
                                { ...(m || {}), can_distribute_leads: v },
                              ],
                            })
                          }
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Toggle
                          checked={u.isActive !== false}
                          onChange={(v) =>
                            updateEmployeeCaps(u._id, { isActive: v })
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateEmployeeModal
          onClose={() => setShowCreate(false)}
          onCreated={loadEmployees}
        />
      )}
    </section>
  );
}

/* ---------- small UI bits ---------- */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`inline-flex h-7 w-12 items-center rounded-full transition px-0.5 ${
        checked ? "bg-[color:var(--brand-600)]" : "bg-gray-300 dark:bg-zinc-700"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`h-6 w-6 bg-white rounded-full shadow transform transition ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function CreateEmployeeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "lead_operator",
  });
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) {
      onCreated();
      onClose();
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Create Employee</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <LabeledInput
            icon={<Users2 className="h-4 w-4" />}
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <LabeledInput
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <LabeledInput
            icon={<KeyRound className="h-4 w-4" />}
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-10 rounded-xl border bg-white/80 dark:bg-zinc-900/60 px-3 text-sm border-gray-300 dark:border-zinc-700"
            >
              <option value="lead_operator">lead_operator</option>
              <option value="admin">admin</option>
              <option value="fb_submitter">fb_submitter</option>
              <option value="fb_analytics_viewer">fb_analytics_viewer</option>
              <option value="superadmin">superadmin</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-600)] px-3 py-2 text-white text-sm shadow-sm disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-10 rounded-xl border bg-white/80 dark:bg-zinc-900/60 px-3 ${
            icon ? "pl-9" : ""
          } text-sm border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]`}
        />
      </div>
    </div>
  );
}
