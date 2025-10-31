"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function SessionValidator() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip auth checks on login/secure pages
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/secure-login") ||
      pathname.startsWith("/unauthorized")
    )
      return;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/session/validate", { cache: "no-store" });
        const data = await res.json();

        if (!data.valid) {
          toast.error("Your session has expired. Please log in again.", {
            duration: 4000,
          });
          router.push("/sign-in");
        }
      } catch {
        toast.error("Session check failed. Please log in again.");
        router.push("/sign-in");
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [pathname, router]);

  return null;
}
