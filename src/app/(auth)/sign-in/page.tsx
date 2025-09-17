"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password: pw,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) setErr(res.error);
    else window.location.href = "/dashboard";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Animated gradient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90 dark:opacity-80 animate-gradient"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #063436, #0F7A7A, #0FA3A3, #063436)",
        }}
      />
      {/* Soft vignette */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_10%,rgba(255,255,255,0.55),rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(60%_50%_at_50%_10%,rgba(6,52,54,0.35),rgba(0,0,0,0)_60%)]" />

      {/* Floating blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-teal-600/30 blur-3xl animate-float" />
      <div
        className="absolute bottom-[-6rem] right-[-6rem] h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl animate-float"
        style={{ animationDelay: "1.2s" }}
      />

      {/* Content */}
      <section className="mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4">
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {/* Left: brand / hero */}
          <div className="hidden select-none md:flex md:flex-col md:justify-center">
            <div className="relative mx-auto h-20 w-20 animate-glow">
              <Image
                src="/logo.png"
                alt="Brand"
                fill
                priority
                className="object-contain drop-shadow-[0_8px_24px_rgba(15,122,122,0.35)]"
              />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">
              Lead & FB ID Portal
            </h1>
            <p className="mt-2 max-w-md text-sm opacity-80">
              Streamlined distribution, realtime screenshots, and single-device
              secure sign-in — powered by a teal system theme that follows your
              device.
            </p>

            {/* Feature pills */}
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

          {/* Right: glass card */}
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-tr from-[#0F7A7A] to-[#0FA3A3] opacity-30 blur-xl" />
            <div className="relative rounded-3xl border border-white/50 bg-white/70 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10">
                  <Image
                    src="/logo.png"
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
                  <div className="group relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="
  w-full rounded-xl border border-zinc-300/70 
  bg-white/70 px-4 py-3 text-sm 
  outline-none ring-0 backdrop-blur 
  placeholder:opacity-60 
  focus:bg-white focus:border-teal-600 focus:shadow-lg
  dark:border-white/10 dark:bg-white/10 
  dark:focus:bg-zinc-900 dark:focus:border-teal-400
  transition-colors duration-200
"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-0 my-2 mr-2 inline-flex w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm dark:via-white/10 animate-[shine_1.8s_linear_infinite]" />
                  </div>
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
                      className="
  w-full rounded-xl border border-zinc-300/70 
  bg-white/70 px-4 py-3 text-sm 
  outline-none ring-0 backdrop-blur 
  placeholder:opacity-60 
  focus:bg-white focus:border-teal-600 focus:shadow-lg
  dark:border-white/10 dark:bg-white/10 
  dark:focus:bg-zinc-900 dark:focus:border-teal-400
  transition-colors duration-200
"
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

                <div className="flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs opacity-80">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0F7A7A]"
                    />
                    Remember me
                  </label>
                  <a
                    className="text-xs text-teal-700 hover:underline dark:text-teal-300"
                    href="#"
                  >
                    Forgot password?
                  </a>
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

              {/* bottom meta / version */}
              <div className="mt-4 flex items-center justify-between text-[11px] opacity-60">
                <span>Secure single-device login</span>
                <span>v1.0</span>
              </div>
            </div>

            {/* Floating badge */}
            <div className="pointer-events-none absolute -right-4 -top-4 select-none rounded-full bg-[#0F7A7A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur">
              DataVerse
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
