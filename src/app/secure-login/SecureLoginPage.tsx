"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function SecureLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [message, setMessage] = useState("Verifying your secure login link...");
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing or invalid token.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/magic-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          setStatus("success");
          setMessage("Login successful! Redirecting to dashboard...");
          setTimeout(() => setFadeOut(true), 1000);
          setTimeout(() => router.replace("/dashboard"), 1800);
        } else {
          setStatus("error");
          setMessage(data.error || "Invalid or expired link.");
        }
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 overflow-hidden">
      <AnimatePresence>
        {!fadeOut && (
          <motion.div
            key="secure-box"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className={`relative w-full max-w-md rounded-2xl p-8 border ${
              status === "error"
                ? "border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                : status === "success"
                ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "border-zinc-700/40 shadow-[0_0_15px_rgba(45,212,191,0.2)]"
            } bg-zinc-900/60 backdrop-blur-xl text-center`}
          >
            <motion.h1
              className="text-xl font-semibold mb-3 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Secure Login Verification
            </motion.h1>

            <motion.div
              className="flex flex-col items-center gap-4 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {status === "loading" && (
                <>
                  <Loader2 className="animate-spin text-cyan-400" size={42} />
                  <p className="text-zinc-400 text-sm">{message}</p>
                </>
              )}

              {status === "success" && (
                <>
                  <CheckCircle2 className="text-emerald-400" size={44} />
                  <p className="text-emerald-300 text-sm font-medium">
                    {message}
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <XCircle className="text-red-400" size={44} />
                  <p className="text-red-400 text-sm font-medium">{message}</p>
                  <p
                    className="mt-3 px-4 py-2 text-sm  dark:text-white text-black rounded-md transition"
                  >
                    Ask your Administrator to give you a new link.
                  </p>
                </>
              )}
            </motion.div>

            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-cyan-500/20 via-emerald-500/10 to-transparent blur-3xl opacity-30 pointer-events-none"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
