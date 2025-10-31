"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function SessionValidator() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // ⛔ Skip validation on public pages
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/secure-login") ||
      pathname.startsWith("/unauthorized")
    ) {
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/session/validate", { cache: "no-store" });
        const data = await res.json();
        if (!data.valid) router.push("/sign-in");
      } catch {
        router.push("/sign-in");
      }
    }, 1000); // wait 1s after mount for smoother UX

    return () => clearTimeout(timeout);
  }, [pathname, router]);

  return null;
}
