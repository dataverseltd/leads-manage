"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Download,
  ShieldCheck,
  PackagePlus,
  Calendar,
  Copy,
} from "lucide-react";

/* ------------ Types ------------ */

type Company = {
  _id: string;
  name: string;
  roleMode?: "uploader" | "receiver" | "hybrid";
  code?: string;
  active?: boolean;
};

type Product = {
  _id: string;
  name: string;
  order?: number;
  active?: boolean;
};

type Membership = {
  companyId?: string;
  role?:
    | "superadmin"
    | "admin"
    | "lead_operator"
    | "fb_submitter"
    | "fb_analytics_viewer"
    | "employee"
    | string;
  can_manage_products?: boolean;
};

type AppSession = {
  role?: string;
  memberships?: Membership[];
  user?: unknown; // we won’t rely on nested user for role/caps
};

type ProductsResponse =
  | {
      month: string;
      products: Product[];
      fallback?: undefined;
    }
  | {
      month: string;
      products: Product[];
      fallback: { month: string; products: Product[] };
    }
  | { error: string };

const isErrorPayload = (v: unknown): v is { error: string } =>
  typeof v === "object" &&
  v !== null &&
  "error" in v &&
  typeof (v as { error?: unknown }).error === "string";

const productsFrom = (v: ProductsResponse): Product[] =>
  "products" in v && Array.isArray(v.products) ? v.products : [];

/* ------------ Helpers ------------ */

function getWorkingMonthBD(date = new Date()): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const bdt = new Date(utc + 6 * 60 * 60000);
  const y = bdt.getFullYear();
  const m = String(bdt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getLast12Months(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    list.push(`${y}-${m}`);
  }
  return list;
}

function SkeletonBadge() {
  return (
    <span className="inline-flex h-7 w-24 animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-800/70" />
  );
}
function SkeletonChip() {
  return (
    <span className="inline-flex h-7 w-28 animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-800/70" />
  );
}
function SkeletonInput() {
  return (
    <div className="h-9 w-56 animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-800/70" />
  );
}

/* ------------ Component ------------ */

export default function CompanyProductsPage() {
  const { data } = useSession();
  const session = (data ?? {}) as AppSession;

  const router = useRouter();
  const params = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>(
    params.get("companyId") || ""
  );

  const [products, setProducts] = useState<Product[]>([]);

  const [input, setInput] = useState("");
  const [bulk, setBulk] = useState("");
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState<string>(
    params.get("month") || getWorkingMonthBD()
  );
  const months = useMemo(getLast12Months, []);

  const [fallbackInfo, setFallbackInfo] = useState<{
    month: string;
    products: Product[];
  } | null>(null);

  const currentCompany = useMemo(
    () => companies.find((c) => String(c._id) === String(companyId)),
    [companies, companyId]
  );

  const isGlobalSuper = useMemo(() => {
    const globalRole = session.role;
    const memberships = session.memberships ?? [];
    return (
      globalRole === "superadmin" ||
      memberships.some((m) => m?.role === "superadmin")
    );
  }, [session]);

  const isUploaderCompany = currentCompany?.roleMode === "uploader";

  const canEdit = useMemo(() => {
    if (isUploaderCompany) return false;
    const memberships = session.memberships ?? [];
    if (!companyId) return false;
    if (isGlobalSuper) return true;
    const m = memberships.find(
      (mm) => String(mm.companyId) === String(companyId)
    );
    return !!m && (m.role === "admin" || !!m?.can_manage_products);
  }, [session, companyId, isGlobalSuper, isUploaderCompany]);

  async function loadCompanies() {
    const isSuper =
      session.role === "superadmin" ||
      (session.memberships ?? []).some((m) => m?.role === "superadmin");

    const qs = new URLSearchParams({ active: "1" });
    if (!isSuper) qs.set("scope", "memberships");

    const res = await fetch(`/api/admin/companies?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load companies");
    const data = (await res.json()) as Company[];
    setCompanies(data);

    if (!companyId && data.length) {
      setCompanyId(data[0]._id);
      const sp = new URLSearchParams(Array.from(params.entries()));
      sp.set("companyId", data[0]._id);
      sp.set("month", month);
      router.replace(`?${sp.toString()}`);
    }
  }

  async function loadProducts(forCompanyId = companyId, forMonth = month) {
    if (!forCompanyId || !forMonth) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/admin/companies/${encodeURIComponent(
          forCompanyId
        )}/monthly-products?month=${encodeURIComponent(forMonth)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) {
        const msg = isErrorPayload(data) ? data.error : "Failed to load";
        throw new Error(msg);
      }

      setProducts(productsFrom(data));
      setFallbackInfo(
        "fallback" in data && data.fallback
          ? { month: data.fallback.month, products: data.fallback.products }
          : null
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load products";
      toast.error(msg);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadCompanies();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companyId) loadProducts(companyId, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, month]);

  const addOne = async () => {
    const name = input.trim();
    if (!name) return;
    setInput("");

    const tempId = `temp-${Date.now()}`;
    setProducts((prev) =>
      prev.some((p) => p.name === name)
        ? prev
        : [...prev, { _id: tempId, name }]
    );

    try {
      const res = await fetch(
        `/api/admin/companies/${encodeURIComponent(
          companyId
        )}/monthly-products?month=${encodeURIComponent(month)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) {
        const msg = isErrorPayload(data) ? data.error : "Add failed";
        throw new Error(msg);
      }

      setProducts(productsFrom(data));
      toast.success("Product added");
    } catch (e) {
      setProducts((p) => p.filter((x) => x._id !== tempId));
      const msg = e instanceof Error ? e.message : "Add failed";
      toast.error(msg);
    }
  };

  const removeOne = async (id: string) => {
    const prev = products;
    setProducts((p) => p.filter((x) => x._id !== id));
    try {
      const res = await fetch(
        `/api/admin/companies/${encodeURIComponent(
          companyId
        )}/monthly-products?month=${encodeURIComponent(month)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) {
        const msg = isErrorPayload(data) ? data.error : "Remove failed";
        throw new Error(msg);
      }
      setProducts(productsFrom(data));
      toast.success("Removed");
    } catch (e) {
      setProducts(prev);
      const msg = e instanceof Error ? e.message : "Remove failed";
      toast.error(msg);
    }
  };

  const bulkReplace = async () => {
    const lines = bulk
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast("Paste one product per line");
      return;
    }
    const prev = products;
    setProducts(
      lines.map((n, i) => ({ _id: `temp-${i}-${Date.now()}`, name: n }))
    );
    try {
      const res = await fetch(
        `/api/admin/companies/${encodeURIComponent(
          companyId
        )}/monthly-products?month=${encodeURIComponent(month)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: lines }),
        }
      );
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) {
        const msg = isErrorPayload(data) ? data.error : "Save failed";
        throw new Error(msg);
      }
      setProducts(productsFrom(data));
      toast.success("Saved");
    } catch (e) {
      setProducts(prev);
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    }
  };

  const copyFromFallback = async () => {
    if (!fallbackInfo) return;
    try {
      const res = await fetch(
        `/api/admin/companies/${encodeURIComponent(
          companyId
        )}/monthly-products/clone?target=${encodeURIComponent(
          month
        )}&from=${encodeURIComponent(fallbackInfo.month)}`,
        { method: "POST" }
      );
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) {
        const msg = isErrorPayload(data) ? data.error : "Clone failed";
        throw new Error(msg);
      }
      setProducts(productsFrom(data));
      setFallbackInfo(null);
      toast.success(`Copied ${fallbackInfo.month} → ${month}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Clone failed";
      toast.error(msg);
    }
  };

  const isLoadingUI = loading || fetching;

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Company Products (Monthly)
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 text-xs">
              <ShieldCheck className="h-4 w-4" />
              {canEdit ? "Can Edit" : "Read-Only"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure products per company and per month. Upload-only companies
            are locked.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Company select */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">
              Company
            </label>
            {companies.length > 0 ? (
              <div className="relative">
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    const sp = new URLSearchParams(
                      Array.from(params.entries())
                    );
                    sp.set("companyId", e.target.value);
                    sp.set("month", month);
                    router.replace(`?${sp.toString()}`);
                  }}
                  className="appearance-none pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
                >
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                —
              </span>
            )}
          </div>

          {/* Month select */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">
              Month
            </label>
            <div className="relative">
              <select
                value={month}
                onChange={(e) => {
                  const m = e.target.value;
                  setMonth(m);
                  const sp = new URLSearchParams(Array.from(params.entries()));
                  sp.set("month", m);
                  if (companyId) sp.set("companyId", companyId);
                  router.replace(`?${sp.toString()}`);
                }}
                className="appearance-none pr-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
              >
                {months.map((mm) => (
                  <option key={mm} value={mm}>
                    {mm}
                  </option>
                ))}
              </select>
              <Calendar className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <button
            onClick={() => {
              loadCompanies().then(() => {
                if (companyId) {
                  return loadProducts(companyId, month);
                }
              });
            }}
            disabled={fetching}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Lock banner by company mode */}
      {isUploaderCompany && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
          This is an <strong>upload-only</strong> company. Product editing is
          disabled by policy.
        </div>
      )}

      {/* Fallback banner (no config for this month) */}
      {fallbackInfo && (
        <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-3 text-blue-800 dark:border-blue-700/60 dark:bg-blue-900/20 dark:text-blue-200 flex items-center justify-between gap-3">
          <div>
            No products configured for <strong>{month}</strong>. Showing{" "}
            <strong>{fallbackInfo.month}</strong>.
          </div>
          {canEdit && !isUploaderCompany && (
            <button
              onClick={copyFromFallback}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-white/70 dark:bg-blue-900/40 px-3 py-1.5 text-sm hover:bg-white"
            >
              <Copy className="h-4 w-4" />
              Copy here
            </button>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current products list */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Products for {currentCompany?.name || "—"} — {month}
            </h2>
            {canEdit && !isUploaderCompany ? (
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="New product name"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addOne();
                  }}
                />
                <button
                  onClick={addOne}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SkeletonInput />
                <SkeletonBadge />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isLoadingUI ? (
              <>
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonChip key={i} />
                ))}
              </>
            ) : products.length ? (
              products.map((p) => (
                <span
                  key={p._id}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-1 text-sm ring-1 ring-gray-200 dark:ring-gray-700"
                >
                  {p.name}
                  {canEdit && !isUploaderCompany && (
                    <button
                      onClick={() => removeOne(p._id)}
                      className="ml-1 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No products yet.
              </div>
            )}
          </div>
        </div>

        {/* Bulk editor */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PackagePlus className="h-4 w-4" />
            Bulk Replace
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Paste one product per line. Saving replaces the entire list for{" "}
            <strong>{month}</strong>.
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"TransUnion\nIQ\nYourScore\nBestFree\nClickFree\nVFS"}
            className="mt-3 w-full h-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
            disabled={!canEdit || isUploaderCompany}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={bulkReplace}
              disabled={!canEdit || isUploaderCompany}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Save Bulk
            </button>
            <button
              onClick={() => setBulk(products.map((p) => p.name).join("\n"))}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Download className="h-4 w-4" />
              Load Current
            </button>
          </div>
        </div>
      </div>

      {fetching && (
        <div className="mt-6 h-2 w-full animate-pulse rounded bg-gray-200/70 dark:bg-gray-800/70" />
      )}
    </div>
  );
}
