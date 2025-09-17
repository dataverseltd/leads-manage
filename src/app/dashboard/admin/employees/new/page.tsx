"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Mail,
  IdCard,
  Lock,
  Shield,
  Building2,
  Loader2,
  CheckCircle2,
  ToggleLeft,
  Lock as LockIcon,
} from "lucide-react";

type Caps = {
  canUploadLeads: boolean;
  canReceiveLeads: boolean;
  can_distribute_leads: boolean;
  can_distribute_fbids: boolean;
  can_create_user: boolean;
};

type Company = { _id: string; name: string; code?: string; active?: boolean };

type MembershipRole =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "employee"
  | string;

type Membership = {
  companyId?: string;
  role?: MembershipRole;
};

type AppSession = {
  memberships?: Membership[];
  caps?: { can_create_user?: boolean };
};

const BASE_ROLES = [
  { value: "lead_operator", label: "Lead Operator" },
  { value: "fb_submitter", label: "FB Submitter" },
  { value: "fb_analytics_viewer", label: "FB Analytics Viewer" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

// --- Policies ---------------------------------------------------------------

/**
 * Company policies by code:
 * - A: Hide "Can Receive Leads" for ALL roles and force it FALSE.
 * - B (Dataverse): If role=lead_operator -> only "Can Receive Leads" = TRUE, others FALSE (hide others).
 *   Also restrict visible roles to ["lead_operator", "admin", "superadmin"].
 */
function getCompanyPolicy(company?: Company) {
  if (!company) {
    return {
      restrictRoles: null as string[] | null,
      forceLOOnlyReceive: false,
      hideReceiveForAll: false,
    };
  }
  if (company.code === "A") {
    return {
      restrictRoles: null,
      forceLOOnlyReceive: false,
      hideReceiveForAll: true,
    };
  }
  if (company.code === "B") {
    return {
      restrictRoles: ["lead_operator", "admin", "superadmin"],
      forceLOOnlyReceive: true,
      hideReceiveForAll: false,
    };
  }
  return {
    restrictRoles: null,
    forceLOOnlyReceive: false,
    hideReceiveForAll: false,
  };
}

/** Role defaults (admin/superadmin are management-only; upload/receive always false) */
function roleDefaultCaps(role: string): Caps {
  switch (role) {
    case "superadmin":
      return {
        canUploadLeads: false,
        canReceiveLeads: false,
        can_distribute_leads: true,
        can_distribute_fbids: true,
        can_create_user: true,
      };
    case "admin":
      return {
        canUploadLeads: false,
        canReceiveLeads: false,
        can_distribute_leads: true,
        can_distribute_fbids: true,
        can_create_user: true,
      };
    case "lead_operator":
      return {
        canUploadLeads: false,
        canReceiveLeads: true,
        can_distribute_leads: false,
        can_distribute_fbids: false,
        can_create_user: false,
      };
    default:
      return {
        canUploadLeads: false,
        canReceiveLeads: false,
        can_distribute_leads: false,
        can_distribute_fbids: false,
        can_create_user: false,
      };
  }
}

// --- Page -------------------------------------------------------------------

export default function CreateEmployeePage() {
  const { data } = useSession();
  const session = (data ?? {}) as AppSession;

  const memberships: Membership[] = Array.isArray(session.memberships)
    ? session.memberships
    : [];
  const isSuperadmin = memberships.some((m) => m?.role === "superadmin");
  const canCreate = isSuperadmin || Boolean(session.caps?.can_create_user);

  // Company list (names)
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesErr, setCompaniesErr] = useState<string | null>(null);

  // Form state
  const [state, setState] = useState({
    companyId: "",
    name: "",
    email: "",
    employeeId: "",
    password: "",
    role: "lead_operator",
    caps: roleDefaultCaps("lead_operator") as Caps,
  });

  const selectedCompany = companies.find((c) => c._id === state.companyId);
  const { restrictRoles, forceLOOnlyReceive, hideReceiveForAll } =
    getCompanyPolicy(selectedCompany);

  // Roles visible in the dropdown
  const roleOptions = useMemo(() => {
    // base: only show "superadmin" option if current actor is superadmin
    let list = isSuperadmin
      ? BASE_ROLES
      : BASE_ROLES.filter((r) => r.value !== "superadmin");
    if (restrictRoles)
      list = list.filter((r) => restrictRoles.includes(r.value));
    return list;
  }, [isSuperadmin, restrictRoles]);

  // Load companies (membership-scoped)
  useEffect(() => {
    (async () => {
      try {
        setCompaniesLoading(true);
        setCompaniesErr(null);
        const res = await fetch(
          "/api/admin/companies?active=1&scope=memberships",
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load companies");
        const data = (await res.json()) as Company[];
        setCompanies(data);
        if (data.length === 1 && !state.companyId) {
          setState((s) => ({ ...s, companyId: data[0]._id }));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load companies";
        setCompaniesErr(msg);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When role changes, reset to role defaults first
  useEffect(() => {
    setState((s) => ({ ...s, caps: roleDefaultCaps(s.role) }));
  }, [state.role]);

  // Enforce company policy constraints whenever role or company changes
  useEffect(() => {
    setState((s) => {
      let caps = { ...s.caps };

      // Admin/Superadmin: ensure mgmt-only (upload/receive false)
      if (s.role === "admin" || s.role === "superadmin") {
        caps.canUploadLeads = false;
        caps.canReceiveLeads = false;
      }

      // Company A: hide receive for all -> force false
      if (hideReceiveForAll) {
        caps.canReceiveLeads = false;
      }

      // Company B + Lead Operator: only receive = true; others false
      if (forceLOOnlyReceive && s.role === "lead_operator") {
        caps = {
          canUploadLeads: false,
          canReceiveLeads: true,
          can_distribute_leads: false,
          can_distribute_fbids: false,
          can_create_user: false,
        };
      }

      return { ...s, caps };
    });
  }, [state.role, state.companyId, hideReceiveForAll, forceLOOnlyReceive]);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  function setField<K extends keyof typeof state>(k: K, v: (typeof state)[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function setCap<K extends keyof Caps>(k: K, v: Caps[K]) {
    // Lock out superadmin changes
    if (state.role === "superadmin") return;

    // Admins: always false for upload/receive
    if (
      state.role === "admin" &&
      (k === "canUploadLeads" || k === "canReceiveLeads")
    )
      return;

    // Company A: never allow receive leads (hidden anyway)
    if (hideReceiveForAll && k === "canReceiveLeads") return;

    // Company B + Lead Operator: only allow receive=true; nothing else changeable
    if (forceLOOnlyReceive && state.role === "lead_operator") {
      if (!(k === "canReceiveLeads" && v === true)) return;
    }

    setState((s) => ({ ...s, caps: { ...s.caps, [k]: v } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!canCreate) return setToast({ type: "err", msg: "Not allowed" });
    if (!state.companyId)
      return setToast({ type: "err", msg: "Company is required" });
    if (!state.name || !state.email || !state.employeeId || !state.password) {
      return setToast({ type: "err", msg: "Fill all required fields" });
    }
    if (state.role === "superadmin" && !isSuperadmin) {
      return setToast({
        type: "err",
        msg: "Only superadmin can create superadmin",
      });
    }

    // Final payload caps after policy enforcement (defense-in-depth)
    const payloadCaps: Caps = (() => {
      // Admin/Superadmin: upload/receive always false
      if (state.role === "admin" || state.role === "superadmin") {
        return {
          ...state.caps,
          canUploadLeads: false,
          canReceiveLeads: false,
        };
      }
      // Company A: receive false for all roles
      if (hideReceiveForAll) {
        return { ...state.caps, canReceiveLeads: false };
      }
      // Company B + LO: only receive true
      if (forceLOOnlyReceive && state.role === "lead_operator") {
        return {
          canUploadLeads: false,
          canReceiveLeads: true,
          can_distribute_leads: false,
          can_distribute_fbids: false,
          can_create_user: false,
        };
      }
      return state.caps;
    })();

    setSubmitting(true);
    try {
      const resp = await fetch(
        `/api/users?companyId=${encodeURIComponent(state.companyId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: state.name,
            email: state.email,
            employeeId: state.employeeId,
            password: state.password,
            role: state.role,
            caps: payloadCaps,
          }),
        }
      );
      const json: unknown = await resp.json().catch(() => ({}));
      setSubmitting(false);

      if (!resp.ok) {
        const msg =
          typeof json === "object" && json && "error" in json
            ? String(
                (json as { error?: unknown }).error ?? "Failed to create user"
              )
            : "Failed to create user";
        setToast({ type: "err", msg });
        return;
      }
      setToast({ type: "ok", msg: "Employee created" });

      // Reset (keep company & role)
      setState((s) => ({
        ...s,
        name: "",
        email: "",
        employeeId: "",
        password: "",
      }));
    } catch {
      setSubmitting(false);
      setToast({ type: "err", msg: "Network error" });
    }
  }

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-8">
        You don’t have permission to create employees.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-[var(--brand-600)]" />
          Create Employee
        </h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Add a user and assign their role & permissions for a company.
        </p>
      </header>

      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 shadow-sm ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <form
        onSubmit={submit}
        className="grid gap-5 rounded-2xl border border-gray-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-6"
      >
        {/* Company (names, not ids) */}
        <Field label="Company" icon={<Building2 className="h-4 w-4" />}>
          {companiesLoading ? (
            <div className="Input text-sm text-gray-500">
              Loading companies…
            </div>
          ) : companiesErr ? (
            <div className="Input text-sm text-rose-600">{companiesErr}</div>
          ) : companies.length > 1 ? (
            <select
              className="Input"
              value={state.companyId}
              onChange={(e) => setField("companyId", e.target.value)}
              required
            >
              <option value="" disabled>
                Select company
              </option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="Input flex items-center justify-between">
              <span className="truncate">{selectedCompany?.name || "—"}</span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <LockIcon className="h-3.5 w-3.5" /> Locked
              </span>
            </div>
          )}
        </Field>

        {/* Identity */}
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Full Name">
            <input
              className="Input"
              value={state.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Employee ID" icon={<IdCard className="h-4 w-4" />}>
            <input
              className="Input"
              value={state.employeeId}
              onChange={(e) => setField("employeeId", e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Email" icon={<Mail className="h-4 w-4" />}>
            <input
              className="Input"
              type="email"
              value={state.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          </Field>
          <Field label="Password" icon={<Lock className="h-4 w-4" />}>
            <input
              className="Input"
              type="password"
              value={state.password}
              onChange={(e) => setField("password", e.target.value)}
              required
            />
          </Field>
        </div>

        {/* Role */}
        <Field label="Role" icon={<Shield className="h-4 w-4" />}>
          <select
            className="Input"
            value={state.role}
            onChange={(e) => setField("role", e.target.value)}
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Caps */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
          <div className="text-sm font-medium mb-3">Permissions</div>

          {/* Company B + Lead Operator → only Receive (locked ON) */}
          {forceLOOnlyReceive && state.role === "lead_operator" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Toggle
                label="Can Receive Leads"
                checked={true}
                onChange={() => {}}
                disabled
              />
              <div className="text-xs text-gray-500 col-span-full">
                For Dataverse lead operators, only “Can Receive Leads” is
                allowed.
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Upload/Receive hidden for admin/superadmin */}
              {!(state.role === "superadmin" || state.role === "admin") && (
                <>
                  <Toggle
                    label="Can Upload Leads"
                    checked={state.caps.canUploadLeads}
                    onChange={(v) => setCap("canUploadLeads", v)}
                  />
                  {/* Company A: hide Receive for all roles */}
                  {!hideReceiveForAll && (
                    <Toggle
                      label="Can Receive Leads"
                      checked={state.caps.canReceiveLeads}
                      onChange={(v) => setCap("canReceiveLeads", v)}
                    />
                  )}
                </>
              )}

              <Toggle
                label="Can Distribute Leads"
                checked={state.caps.can_distribute_leads}
                onChange={(v) => setCap("can_distribute_leads", v)}
                disabled={state.role === "superadmin"}
              />
              {/* <Toggle
                label="Can Distribute FB IDs"
                checked={state.caps.can_distribute_fbids}
                onChange={(v) => setCap("can_distribute_fbids", v)}
                disabled={state.role === "superadmin"}
              /> */}
              <Toggle
                label="Can Create User"
                checked={state.caps.can_create_user}
                onChange={(v) => setCap("can_create_user", v)}
                disabled={state.role === "superadmin"}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            User will be created under the selected company’s membership.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-white shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {submitting ? "Creating..." : "Create Employee"}
          </button>
        </div>
      </form>
    </section>
  );
}

// --- UI helpers -------------------------------------------------------------

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <div className={icon ? "pl-9" : ""}>{children}</div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800"
          : "border-gray-200 bg-white dark:bg-zinc-900/40 dark:border-zinc-800"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <span className="flex items-center gap-2">
        {label}
        {disabled && <LockIcon className="h-4 w-4 text-gray-400" />}
      </span>
      <ToggleLeft
        className={`h-5 w-5 ${
          checked ? "rotate-180 text-emerald-600" : "text-gray-400"
        }`}
      />
    </button>
  );
}
