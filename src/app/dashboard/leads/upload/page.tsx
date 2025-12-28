// apps/web/src/app/dashboard/lead-submit/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import debounce from "lodash.debounce";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Loader2, Save, RotateCcw, ChevronDown } from "lucide-react";

type LeadForm = {
  fb_id_name: string;
  client_name: string;
  number: string; // required
  rent: string;
  house_apt: string;
  house_apt_details: string;
  address: string;
  post_link: string;
  screenshot_link?: string; // optional
};

const EMPTY: LeadForm = {
  fb_id_name: "",
  client_name: "",
  number: "",
  rent: "",
  house_apt: "",
  house_apt_details: "",
  address: "",
  post_link: "",
  screenshot_link: "",
};

type Suggestion = Pick<
  LeadForm,
  | "fb_id_name"
  | "client_name"
  | "rent"
  | "house_apt"
  | "house_apt_details"
  | "address"
  | "post_link"
>;

type UploadResponse = {
  uploaded?: number;
  assignedNow?: number;
  note?: string | null;
  error?: string;
};

export default function LeadSubmitPage() {
  // 1) Fix: avoid unused var warning by prefixing with underscore
  const { data: _session } = useSession();
  const params = useSearchParams();
  const companyId = params.get("companyId") || params.get("company") || "";

  const [form, setForm] = useState<LeadForm>({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverNote, setServerNote] = useState<string | null>(null);

  // suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);

  // --------- helpers
  const onChange = (k: keyof LeadForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const normalizeNumber = (num: string) => num.replace(/\D/g, "");
  const requiredFields: (keyof LeadForm)[] = [
    "fb_id_name",
    "client_name",
    "number",
    "rent",
    "house_apt",
    "house_apt_details",
    "address",
    "post_link",
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const f of requiredFields) {
      // 2) Fix: remove `any` by using keyof + precise typing
      const val = String((form[f] as string | undefined) ?? "").trim();
      if (!val) {
        const label = f
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        e[f] = `${label} is required`;
      }
    }
    const num = normalizeNumber(form.number);
    if (!num || num.length < 8)
      e.number = "Phone number must be at least 8 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // --------- draft autosave
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem("lead-submit-draft", JSON.stringify(form));
      } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [form]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lead-submit-draft");
      if (raw) setForm(JSON.parse(raw) as LeadForm);
    } catch {}
  }, []);

  // --------- suggestions
  // debounced fetch by fb_id_name
  const fetchSuggestions = useMemo(
    () =>
      debounce(async (query: string) => {
        if (!query || query.length < 2) {
          setSuggestions([]);
          setOpenSuggest(false);
          return;
        }
        try {
          const res = await fetch(
            `/api/leads/search?fb_id_name=${encodeURIComponent(query)}`
          );
          if (!res.ok) throw new Error("Failed");
          const data = (await res.json()) as Suggestion[];
          setSuggestions(data || []);
          setOpenSuggest(true);
        } catch {
          setSuggestions([]);
          setOpenSuggest(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    fetchSuggestions(form.fb_id_name);
  }, [form.fb_id_name, fetchSuggestions]);

  const applySuggestion = (s: Suggestion) => {
    setForm((f) => ({
      ...f,
      fb_id_name: s.fb_id_name || f.fb_id_name,
      client_name: s.client_name || f.client_name,
      rent: s.rent || f.rent,
      house_apt: s.house_apt || f.house_apt,
      house_apt_details: s.house_apt_details || f.house_apt_details,
      address: s.address || f.address,
      post_link: s.post_link || f.post_link,
      // keep user's current number blank to force fresh input
      number: "",
    }));
    setOpenSuggest(false);
  };

  // --------- submit
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerNote(null);
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
      const res = await fetch(`/api/leads/upload${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [{ ...form, number: normalizeNumber(form.number) }],
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as UploadResponse;
      if (!res.ok) throw new Error(data?.error || "Failed to save lead");

      setServerNote(data?.note ?? null);
      toast.success(
        `Saved! Uploaded: ${data?.uploaded ?? 1}. Assigned now: ${
          data?.assignedNow ?? 0
        }`
      );
      setForm((f) => ({ ...f, number: "" }));
      setErrors({});
    } catch (err: unknown) {
      // 3) Fix: no `any` in catch; use `unknown` + type guard
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error(
          "Upload took too long. Check connection; the lead may still have been saved."
        );
      } else if (err instanceof Error) {
        toast.error(err.message || "Upload failed");
      } else {
        toast.error("Upload failed");
      }
    } finally {
      clearTimeout(t);
      setLoading(false);
    }
  };

  const onReset = () => {
    setForm({ ...EMPTY });
    setErrors({});
    setServerNote(null);
    try {
      localStorage.removeItem("lead-submit-draft");
    } catch {}
  };

  return (
    <section className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-6 shadow-sm">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Submit New Lead
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {companyId
              ? `Company: ${companyId}`
              : "Company inferred from your session."}
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* FB ID Name with suggestions */}
          <div className="relative md:col-span-2">
            <Field
              label="FB ID / Name"
              value={form.fb_id_name}
              onChange={(v) => onChange("fb_id_name", v)}
              placeholder="e.g., John FB"
              error={errors.fb_id_name}
              required
            />
            {openSuggest && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.fb_id_name}-${i}`}
                    className="px-3 py-2 text-sm text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                    onClick={() => applySuggestion(s)}
                  >
                    {s.fb_id_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field
            label="Client Name"
            value={form.client_name}
            onChange={(v) => onChange("client_name", v)}
            placeholder="e.g., John Doe"
            error={errors.client_name}
            required
          />

          <Field
            label="Phone Number"
            value={form.number}
            onChange={(v) => onChange("number", v)}
            placeholder="017XXXXXXXX"
            error={errors.number}
            required
          />

          <Field
            label="Expected Rent"
            value={form.rent}
            onChange={(v) => onChange("rent", v)}
            placeholder="e.g., 12000"
            error={errors.rent}
            required
          />

          <SelectField
            label="House / Apt"
            value={form.house_apt}
            onChange={(v) => onChange("house_apt", v)}
            options={[
              { value: "", label: "Select Type" },
              { value: "House", label: "House" },
              { value: "Apartment", label: "Apartment" },
            ]}
            error={errors.house_apt}
            required
          />

          <Field
            label="House / Apt Details"
            value={form.house_apt_details}
            onChange={(v) => onChange("house_apt_details", v)}
            placeholder="2 Bed, 900 sft"
            error={errors.house_apt_details}
            required
          />

          <Field
            label="Address"
            value={form.address}
            onChange={(v) => onChange("address", v)}
            placeholder="Area, City"
            error={errors.address}
            required
          />

          <Field
            label="Post Link"
            value={form.post_link}
            onChange={(v) => onChange("post_link", v)}
            placeholder="https://facebook.com/post/..."
            error={errors.post_link}
            required
          />

          <Field
            label="Screenshot Link (optional)"
            value={form.screenshot_link || ""}
            onChange={(v) => onChange("screenshot_link", v)}
            placeholder="https://..."
          />

          {/* Actions */}
          <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              All fields are required except Screenshot Link.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {loading ? "Saving…" : "Save Lead"}
              </button>
            </div>
          </div>

          {serverNote && (
            <div className="md:col-span-2 mt-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-sm text-gray-700 dark:text-zinc-300">
              {serverNote}
            </div>
          )}
        </form>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/dashboard/leads"
          className="inline-block text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
        >
          View Uploaded Leads →
        </Link>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      <input
        className={[
          "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
          "bg-white dark:bg-zinc-900",
          error
            ? "border-rose-300 dark:border-rose-700 focus:ring-2 focus:ring-rose-400/30 dark:focus:ring-rose-500/20"
            : "border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10",
        ].join(" ")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      <div className="relative">
        <select
          className={[
            "mt-1 w-full appearance-none rounded-xl border px-3 py-2 text-sm outline-none",
            "bg-white dark:bg-zinc-900 pr-9",
            error
              ? "border-rose-300 dark:border-rose-700 focus:ring-2 focus:ring-rose-400/30 dark:focus:ring-rose-500/20"
              : "border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10",
          ].join(" ")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}
