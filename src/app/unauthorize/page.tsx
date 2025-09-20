// src/app/unauthorize/page.tsx
export const dynamic = "force-dynamic"; // avoid static pre-render

import Link from "next/link";
import { ShieldX, ArrowLeft, LogOut, Info } from "lucide-react";

export default function UnauthorizePage({
  searchParams,
}: {
  searchParams?: { reason?: string };
}) {
  const reason = searchParams?.reason || "";

  const reasonText =
    reason === "admin-only"
      ? "This area is reserved for admin users."
      : reason === "receiver-required"
      ? "You need a membership in a receiver-mode company to access this page."
      : reason === "blocked-role"
      ? "Your current role does not have permission to view admin pages."
      : "You don’t have permission to access this page.";

  return (
    <main className="min-h-[70vh] w-full flex items-center justify-center px-6 py-10">
      <section
        className="
          w-full max-w-2xl rounded-2xl border
          bg-white/70 backdrop-blur-sm
          shadow-sm
          px-6 py-8
          sm:px-10 sm:py-12
          dark:bg-neutral-900/70 dark:border-neutral-800 dark:shadow-none
        "
        aria-labelledby="unauth-title"
      >
        <div className="flex items-start gap-4">
          <div
            className="
              inline-flex h-12 w-12 items-center justify-center rounded-xl
              border
              bg-white
              dark:bg-neutral-900
              dark:border-neutral-800
            "
          >
            <ShieldX className="h-6 w-6" />
          </div>

          <div className="flex-1">
            <h1
              id="unauth-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Access denied
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {reasonText}
            </p>

            <div
              className="
                mt-5 rounded-xl border bg-neutral-50 px-4 py-4 text-sm
                dark:bg-neutral-900 dark:border-neutral-800
              "
            >
              <div className="flex items-center gap-2 font-medium">
                <Info className="h-4 w-4" />
                What can you do?
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
                <li>
                  If you belong to multiple companies,{" "}
                  <span className="font-medium">
                    switch to a receiver company
                  </span>{" "}
                  and try again.
                </li>
                <li>
                  Ask an admin/superadmin to{" "}
                  <span className="font-medium">
                    update your role or permissions
                  </span>
                  .
                </li>
                <li>
                  Go back to your <span className="font-medium">Dashboard</span>{" "}
                  to continue other tasks.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="
                  inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
                  hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2
                  dark:hover:bg-neutral-800 dark:focus:ring-neutral-700
                "
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>

              <Link
                href="/sign-in"
                className="
                  ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
                  hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2
                  dark:hover:bg-neutral-800 dark:focus:ring-neutral-700
                "
              >
                <LogOut className="h-4 w-4" />
                Sign in with another account
              </Link>
            </div>

            <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-500">
              If you believe this is an error, contact your system administrator
              with a screenshot of this page.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
