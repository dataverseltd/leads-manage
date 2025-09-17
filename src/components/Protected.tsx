"use client";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  if (status === "loading") return <div className="p-6">Loading...</div>;
  if (status === "unauthenticated")
    return (
      <div className="p-6">
        You are signed out.{" "}
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
      </div>
    );
  return <>{children}</>;
}
