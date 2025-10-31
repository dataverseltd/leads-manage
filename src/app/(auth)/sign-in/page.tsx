"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const brandName = process.env.NEXT_PUBLIC_BRAND;
  const logo = process.env.NEXT_PUBLIC_LOGO || "/logo.png";
  // ✅ Prevent infinite refresh loop
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard"); // use replace to stop re-navigation loops
    }
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password: pw,
      redirect: false, // we handle redirect manually
    });

    setLoading(false);

    if (res?.error) {
      setErr("Invalid email or password");
    } else {
      // ✅ Reload page to update session instantly
      window.location.href = "/dashboard";
    }
  }

  // ✅ Avoid showing login form while already logged in
  if (status === "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
        Redirecting to your dashboard…
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90 dark:opacity-80 animate-gradient"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #063436, #0F7A7A, #0FA3A3, #063436)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_10%,rgba(255,255,255,0.55),rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(60%_50%_at_50%_10%,rgba(6,52,54,0.35),rgba(0,0,0,0)_60%)]" />

      <section className="mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4">
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {/* Left panel */}
          <div className="hidden select-none md:flex md:flex-col md:justify-center">
            <div className="relative mx-auto h-20 w-20 animate-glow">
              <Image
                src={logo}
                alt="Brand"
                fill
                priority
                className="object-contain drop-shadow-[0_8px_24px_rgba(15,122,122,0.35)]"
              />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">
              {brandName}
            </h1>
            <p className="mt-2 max-w-md text-sm opacity-80">
              Streamlined distribution, realtime screenshots, and single-device
              secure sign-in — powered by a teal system theme that follows your
              device.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {[
                "Single-device login",
                "Realtime updates",
                "System dark mode",
                "Secure by design",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-teal-600/30 bg-white/60 px-3 py-1.5 backdrop-blur dark:bg-white/5"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-tr from-[#0F7A7A] to-[#0FA3A3] opacity-30 blur-xl" />
            <div className="relative rounded-3xl border border-white/50 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10">
                  <Image
                    src={logo}
                    alt="Brand"
                    fill
                    className="object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Welcome back</h2>
                  <p className="text-sm opacity-70">Sign in to continue</p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium opacity-80">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-zinc-300/70 bg-white/70 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:shadow-lg dark:border-white/10 dark:bg-white/10 dark:focus:bg-zinc-900 dark:focus:border-teal-400 transition-colors duration-200"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium opacity-80">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-zinc-300/70 bg-white/70 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:shadow-lg dark:border-white/10 dark:bg-white/10 dark:focus:bg-zinc-900 dark:focus:border-teal-400 transition-colors duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs opacity-80 hover:opacity-100"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="rounded-lg border border-red-500/30 bg-red-50/70 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-300">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#063436] to-[#0F7A7A] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-teal-700/25 disabled:opacity-60"
                >
                  <span className="relative z-10">
                    {loading ? "Signing in…" : "Sign in"}
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-white/20 transition group-hover:translate-x-0" />
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between text-[11px] opacity-60">
                <span>Secure single-device login</span>
                <span>v1.0</span>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-4 -top-4 select-none rounded-full bg-[#0F7A7A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur">
              {brandName}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
