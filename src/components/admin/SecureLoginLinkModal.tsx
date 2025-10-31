"use client";

import { useState, useEffect } from "react";
import { Copy, Loader2, CheckCircle2, Link2, Clock3, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

interface GenerateResponse {
  link: string;
  expiresAt?: string;
  error?: string;
}

export default function SecureLoginLinkModal({
  userId,
  userName,
  onClose,
}: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  // ✅ Generate secure login link
  async function generateLink(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/generate-login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data: GenerateResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");

      setLink(data.link);
      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
      toast.success("✅ Secure login link generated successfully!");
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Error generating link";
      toast.error(error);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Copy to clipboard
  const handleCopy = (): void => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 1500);
  };

  // ✅ Expiry countdown
  useEffect(() => {
    if (!expiresAt) return;
    const updateCountdown = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Expired");
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown(`${h}h ${m}m left`);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 60_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Gradient Accent */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-black dark:hover:text-white"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Secure Login Link
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generate a one-time login link for <b>{userName}</b>
            </p>
          </div>

          <AnimatePresence mode="wait">
            {link ? (
              <motion.div
                key="link-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md break-all text-sm text-gray-700 dark:text-gray-200">
                  {link}
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                  >
                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    {copied ? "Copied" : "Copy Link"}
                  </button>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                  >
                    <Link2 size={18} />
                    Open
                  </a>
                </div>

                <p className="text-center text-xs text-gray-400 flex justify-center items-center gap-1">
                  <Clock3 size={13} />
                  {countdown || "Expires in 12 hours"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="generate-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-center mt-4"
              >
                <button
                  onClick={generateLink}
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 via-cyan-600 to-emerald-500 text-white font-medium rounded-md flex items-center gap-2 hover:brightness-110 transition disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Generating...
                    </>
                  ) : (
                    "Generate Secure Link"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
