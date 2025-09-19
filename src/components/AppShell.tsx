"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
  Upload,
  BarChart2,
  FileImage,
  Settings,
  LogOut,
  Search,
  Bell,
  Moon,
  Sun,
  GitBranch,
  UserPlus,
  Building2,
} from "lucide-react";

/* ---------- Types ---------- */
export type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  external?: boolean;
};

export type NavSection = { heading?: string; items: NavItem[] };

export type Membership = {
  companyId: string;
  companyName: string;
  roleMode: "uploader" | "receiver" | "hybrid";
  isPrimary?: boolean;
};

export type SidebarProps = {
  sections: NavSection[];
  brand?: React.ReactNode;
  user?: { name: string; role?: string; avatarUrl?: string } | null;
  onSignOut?: () => void;
  allowCollapse?: boolean;
  singleCompanyName?: string | null; // <- derived from memberships if exactly one
};

const SIDEBAR_LS_KEY = "sidebar:collapsed";

/* ---------------- THEME ---------------- */
function useDarkToggle() {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const system = mq.matches;
      const stored = localStorage.getItem("theme");
      const dark = stored ? stored === "dark" : system;
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const toggle = () => {
    const next = !isDark;
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
  };

  return { isDark, toggle };
}

/* ---------------- SIDEBAR ---------------- */
export function Sidebar({
  sections,
  brand,
  user,
  onSignOut,
  allowCollapse = true,
  singleCompanyName,
}: SidebarProps) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_LS_KEY) === "1";
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_LS_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { isDark, toggle } = useDarkToggle();
  const width = collapsed ? 76 : 264;

  // Exact-active for /dashboard; prefix-active for other items
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <button
          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <button
          onClick={toggle}
          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        role="presentation"
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 transition ${
          open ? "bg-black/40" : "pointer-events-none bg-transparent"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed z-40 top-0 h-screen lg:translate-x-0 transition-transform duration-300 ease-out lg:flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ width }}
        aria-label="Sidebar"
      >
        {/* Brand + collapse */}
        <div className="flex items-center gap-2 h-14 px-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold truncate">
            {/* {brand ?? <span className="tracking-tight">Hello, </span>} */}
            {!collapsed && singleCompanyName && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                <Building2 className="h-3.5 w-3.5" />
                {singleCompanyName}
              </span>
            )}
          </div>
          <div className="ml-auto hidden lg:flex items-center gap-1">
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title="Ctrl+B"
              onClick={() => allowCollapse && setCollapsed((c) => !c)}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                placeholder="Search…"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="px-2">
              {section.heading && !collapsed && (
                <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {section.heading}
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const base =
                    "group flex items-center gap-3 w-full rounded-lg px-2 py-2 text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
                  const deco = active
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100/60 dark:border-indigo-900/40"
                    : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-transparent";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        className={`${base} ${deco}`}
                        onClick={() => setOpen(false)}
                      >
                        {Icon ? (
                          <Icon
                            className={`h-5 w-5 shrink-0 ${
                              active
                                ? "text-indigo-600 dark:text-indigo-300"
                                : "text-zinc-400"
                            }`}
                          />
                        ) : (
                          <div className="h-5 w-5" />
                        )}
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">
                              {item.label}
                            </span>
                            {item.badge !== undefined && (
                              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] px-2 py-0.5 text-zinc-700 dark:text-zinc-300">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800 p-2">
          {!collapsed && user && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-semibold">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name}
                </div>
                {user.role && (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {user.role}
                  </div>
                )}
              </div>
              <button
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={toggle}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onSignOut}
              className="inline-flex items-center justify-center flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------------- APP SHELL + ROLES/CAPS ---------------- */

type Caps = {
  canUploadLeads?: boolean;
  canReceiveLeads?: boolean;
  can_distribute_leads?: boolean;
  can_distribute_fbids?: boolean;
  can_create_user?: boolean;
  [k: string]: boolean | undefined;
};

export function AppShell({
  children,
  user,
  role,
  caps,
  myLeadsBadge,
  memberships = [],
}: {
  children: React.ReactNode;
  user?: SidebarProps["user"];
  role?: string; // "superadmin" | "admin" | "lead_operator" | ...
  caps?: Caps;
  myLeadsBadge?: number | string;
  memberships?: Membership[];
}) {
  /* ---- membership / company label ---- */
  const active = memberships.find((m) => m.isPrimary);
  const singleCompanyName =
    active?.companyName ??
    (memberships.length === 1 ? memberships[0].companyName : null) ??
    null;

  const getRoleModeForOperator = (): "uploader" | "receiver" | "hybrid" => {
    // If only one membership, use that. If multiple, prefer the primary; else fallback to 'hybrid'.
    if (memberships.length === 1) return memberships[0].roleMode;
    const primary = memberships.find((m) => m.isPrimary);
    return primary?.roleMode ?? "hybrid";
  };

  const canUpload = !!caps?.canUploadLeads;
  const canReceive = !!caps?.canReceiveLeads;
  const canDist = !!caps?.can_distribute_leads || !!caps?.can_distribute_fbids;
  const canCreateUser = !!caps?.can_create_user;

  /* ---------- base Overview ---------- */
  const overview: NavSection = {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        label: "My Leads",
        href: "/dashboard/my-leads",
        icon: Users,
        badge: myLeadsBadge,
      },
      { label: "Upload Lead", href: "/dashboard/leads/upload", icon: Upload },
      {
        label: "Screenshots",
        href: "/dashboard/admin/screenshots",
        icon: FileImage,
      },
      // { label: "Analytics", href: "/dashboard/analytics", icon: BarChart },
    ],
  };
  const hasSignupSummary = memberships.some(
    (m) => m.roleMode === "receiver" || m.roleMode === "hybrid"
  );
  if (hasSignupSummary) {
    overview.items.push({
      label: "Signup Summary",
      href: "/dashboard/signup-summary",
      icon: BarChart2, // you can pick a different icon if you want
    });
  }
  /* ---------- Admin section (dynamic) ---------- */
  const adminSection: NavSection = {
    heading: "Admin",
    items: [],
  };

  /* ---------- Helpers ---------- */
  const renderLayout = (
    sections: NavSection[],
    fallbackUser: { name: string; role?: string }
  ) => {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Sidebar
          sections={sections}
          user={user ?? fallbackUser}
          brand={<span className="text-lg">Hello, </span>}
          singleCompanyName={singleCompanyName}
          onSignOut={() => signOut({ callbackUrl: "/sign-in" })}
        />
        <div className="lg:pl-[264px] transition-[padding] duration-300">
          <header className="hidden lg:flex sticky top-0 z-30 items-center justify-between gap-3 h-14 px-5 bg-white/70 dark:bg-zinc-900/60 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
            <div className="text-sm text-zinc-500">Welcome back</div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main className="p-5">{children}</main>
        </div>
      </div>
    );
  };

  /* ---------- SUPERADMIN ---------- */
  if (role === "superadmin") {
    // Hide My Leads & Upload Lead for superadmin
    const superOverview: NavSection = {
      ...overview,
      items: overview.items.filter(
        (i) =>
          i.href !== "/dashboard/my-leads" &&
          i.href !== "/dashboard/leads/upload"
      ),
    };

    adminSection.items.push(
      {
        label: "Distribution",
        href: "/dashboard/admin/distribution",
        icon: GitBranch,
      },
      {
        label: "Employees / New",
        href: "/dashboard/admin/employees/new",
        icon: UserPlus,
      }
    );

    const sections: NavSection[] = [
      superOverview,
      adminSection,
      {
        heading: "System",
        items: [
          { label: "Settings", href: "/dashboard/settings", icon: Settings },
        ],
      },
    ];

    // If single-company superadmin: we still show company badge (handled by singleCompanyName)
    // If multi-company superadmin (memberships.length > 1): same sections; just no special restrictions beyond hiding MyLeads/UploadLead.
    return renderLayout(sections, { name: "Super Admin", role: "superadmin" });
  }

  /* ---------- ADMIN ---------- */
  if (role === "admin") {
    if (canDist)
      adminSection.items.push({
        label: "Distribution",
        href: "/dashboard/admin/distribution",
        icon: GitBranch,
      });
    if (canCreateUser)
      adminSection.items.push({
        label: "Employees / New",
        href: "/dashboard/admin/employees/new",
        icon: UserPlus,
      });

    const sections: NavSection[] = [overview];
    if (adminSection.items.length) sections.push(adminSection);
    sections.push({
      heading: "System",
      items: [
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ],
    });

    return renderLayout(sections, { name: "Admin", role: "admin" });
  }

  /* ---------- LEAD OPERATOR (membership-based visibility) ---------- */
  if (role === "lead_operator") {
    const roleMode = getRoleModeForOperator();

    if (roleMode === "uploader") {
      // uploader company → only Upload Lead page
      const sections: NavSection[] = [
        {
          heading: "Leads",
          items: [
            {
              label: "Upload Lead",
              href: "/dashboard/leads/upload",
              icon: Upload,
            },
          ],
        },
      ];
      return renderLayout(sections, { name: "User", role: "lead_operator" });
    }

    if (roleMode === "receiver") {
      // receiver company → My Leads + Signup Summary
      const sections: NavSection[] = [
        {
          heading: "Leads",
          items: [
            { label: "My Leads", href: "/dashboard/my-leads", icon: Users },
            {
              label: "Signup Summary",
              href: "/dashboard/signup-summary",
              icon: BarChart2,
            },
          ],
        },
      ];

      return renderLayout(sections, { name: "User", role: "lead_operator" });
    }

    //
    // hybrid → normal overview, but if they canReceive we hide Upload Lead
    const filteredOverview: NavSection = {
      ...overview,
      items: overview.items.filter((i) =>
        canReceive ? i.href !== "/dashboard/leads/upload" : true
      ),
    };

    const sections: NavSection[] = [
      filteredOverview,
      {
        heading: "System",
        items: [
          { label: "Settings", href: "/dashboard/settings", icon: Settings },
        ],
      },
    ];
    return renderLayout(sections, { name: "User", role: "lead_operator" });
  }

  /* ---------- OTHER ROLES (fallback, keep your prior rules) ---------- */
  // Rule A (older): pure uploaders => Dashboard only — but your new rule supersedes for lead_operator.
  if (canUpload && !canReceive) {
    const sections: NavSection[] = [
      {
        heading: "Overview",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
      },
    ];
    return renderLayout(sections, { name: "User" });
  }

  // Rule B: receivers => hide Upload Lead
  const filteredOverview = {
    ...overview,
    items: canReceive
      ? overview.items.filter((i) => i.href !== "/dashboard/leads/upload")
      : overview.items,
  };

  const sections: NavSection[] = [
    filteredOverview,
    {
      heading: "System",
      items: [
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ],
    },
  ];

  return renderLayout(sections, { name: "User" });
}

export default AppShell;
