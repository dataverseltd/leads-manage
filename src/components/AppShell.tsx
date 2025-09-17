"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  external?: boolean;
};

export type NavSection = { heading?: string; items: NavItem[] };

export type SidebarProps = {
  sections: NavSection[];
  brand?: React.ReactNode;
  user?: { name: string; role?: string; avatarUrl?: string } | null;
  onSignOut?: () => void;
  allowCollapse?: boolean;
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
            {brand ?? <span className="tracking-tight">DataVerse</span>}
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
import { GitBranch, UserPlus } from "lucide-react";

type Caps = {
  canUploadLeads?: boolean;
  canReceiveLeads?: boolean;
  can_distribute_leads?: boolean;
  can_distribute_fbids?: boolean;
  can_create_user?: boolean;
  [k: string]: boolean | undefined; // ← was `any`
};

export function AppShell({
  children,
  user,
  role, // <-- NEW
  caps,
  myLeadsBadge,
}: {
  children: React.ReactNode;
  user?: SidebarProps["user"];
  role?: string; // "superadmin" | "admin" | ...
  caps?: Caps;
  myLeadsBadge?: number | string;
}) {
  const canUpload = !!caps?.canUploadLeads;
  const canReceive = !!caps?.canReceiveLeads;
  const canDist = !!caps?.can_distribute_leads || !!caps?.can_distribute_fbids;
  const canCreateUser = !!caps?.can_create_user;

  // ---------- base Overview ----------
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
      { label: "Screenshots", href: "/dashboard/screenshots", icon: FileImage },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
    ],
  };

  // ---------- Admin section (built dynamically) ----------
  const adminSection: NavSection = {
    heading: "Admin",
    items: [],
  };

  // SUPERADMIN: see everything, always show Admin pages
  if (role === "superadmin") {
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

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Sidebar
          sections={[
            overview,
            adminSection,
            {
              heading: "System",
              items: [
                {
                  label: "Settings",
                  href: "/dashboard/settings",
                  icon: Settings,
                },
              ],
            },
          ]}
          user={user ?? { name: "Super Admin", role: "superadmin" }}
          brand={<span className="text-lg">DataVerse</span>}
          onSignOut={() => {}}
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
  }

  // ADMIN: Overview + Admin (gated by caps). Ignore the "uploaders see only dashboard" rule.
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

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Sidebar
          sections={sections}
          user={user ?? { name: "Admin", role: "admin" }}
          brand={<span className="text-lg">DataVerse</span>}
          onSignOut={() => {}}
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
  }

  // OTHER ROLES (operator/submitter/etc.)
  // Rule A: pure uploaders => Dashboard only
  if (canUpload && !canReceive) {
    const sections: NavSection[] = [
      {
        heading: "Overview",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
      },
    ];
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Sidebar
          sections={sections}
          user={user ?? { name: "User", role: "" }}
          brand={<span className="text-lg">DataVerse</span>}
          onSignOut={() => {}}
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
  }

  // Rule B: receivers => hide Upload Lead
  const filteredOverview = { ...overview, items: [...overview.items] }; // ← was `let`
  if (canReceive) {
    filteredOverview.items = filteredOverview.items.filter(
      (i) => i.href !== "/dashboard/leads/upload"
    );
  }

  const sections: NavSection[] = [
    filteredOverview,
    {
      heading: "System",
      items: [
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar
        sections={sections}
        user={user ?? { name: "User", role: "" }}
        brand={<span className="text-lg">DataVerse</span>}
        onSignOut={() => {}}
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
}

export default AppShell;
