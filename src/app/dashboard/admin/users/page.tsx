"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  RotateCcw,
  ShieldCheck,
  KeySquare,
  Trash2,
} from "lucide-react";

type Role =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  employeeId?: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
};

type UsersApiList = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

export default function UsersListPage() {
  const { status } = useSession();
  const sp = useSearchParams();
  const router = useRouter();

  const [companyId, setCompanyId] = useState<string>("");
  const [q, setQ] = useState<string>(sp.get("q") ?? "");
  const [page, setPage] = useState<number>(Number(sp.get("page") ?? 1));
  const [pageSize, setPageSize] = useState<number>(
    Number(sp.get("pageSize") ?? 20)
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UsersApiList | null>(null);

  // resolve active company
  useEffect(() => {
    const urlCompany = sp.get("companyId");
    if (urlCompany) {
      setCompanyId(urlCompany);
      return;
    }
    const ls =
      typeof window !== "undefined"
        ? localStorage.getItem("activeCompanyId")
        : null;
    if (ls) setCompanyId(ls);
  }, [sp]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (companyId) p.set("companyId", companyId);
    return p.toString();
  }, [q, page, pageSize, companyId]);

  useEffect(() => {
    router.replace(`/dashboard/admin/users?${params}`);
  }, [params, router]);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const json: UsersApiList = await res.json();
        if (active) setData(json);
      } catch (e) {
        if (active) setError((e as Error).message || "Failed to load users");
      } finally {
        if (active) setLoading(false);
      }
    }

    // ✅ always run – server will 400 if companyId is required, and we’ll show the error
    run();
    return () => {
      active = false;
    };
  }, [params]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert(await r.text());
      return;
    }
    // refetch
    const res = await fetch(`/api/admin/users?${params}`, {
      cache: "no-store",
    });
    const json: UsersApiList = await res.json();
    setData(json);
  }

  async function handleResetPassword(id: string) {
    const newPassword = prompt("Enter new password (min 8 chars):");
    if (!newPassword) return;
    const r = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!r.ok) {
      alert(await r.text());
      return;
    }
    alert("Password updated.");
  }

  if (status === "loading") {
    return <div className="p-6">Loading session…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Users (Company-scoped)
        </h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search by name/email/employeeId…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-72 bg-transparent"
          />
          <button
            onClick={() => {
              setQ("");
              setPage(1);
            }}
            className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* table */}
      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-[var(--background)] border-b">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>Name</th>
              <th>Email</th>
              <th>Employee ID</th>
              <th>Role</th>
              <th>Created</th>
              <th className="w-44">Actions</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  Loading…
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={6} className="text-center text-red-600 py-8">
                  {error}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              (data?.items ?? []).map((u) => (
                <tr key={u._id} className="border-b hover:bg-black/5">
                  <td className="font-medium">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.employeeId ?? "-"}</td>
                  <td className="uppercase text-xs tracking-wide">{u.role}</td>
                  <td>
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetPassword(u._id)}
                        className="border rounded px-2 py-1 inline-flex items-center gap-1 text-xs"
                        title="Reset Password"
                      >
                        <KeySquare className="h-4 w-4" />
                        Reset
                      </button>
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="border rounded px-2 py-1 inline-flex items-center gap-1 text-xs"
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            {!loading && !error && (data?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  No users found for this company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Total: {data?.total ?? 0}</div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm">Page {page}</span>
          <button
            disabled={(data?.items?.length ?? 0) < pageSize}
            onClick={() => setPage((p) => p + 1)}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border rounded px-2 py-1 text-sm bg-transparent"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
