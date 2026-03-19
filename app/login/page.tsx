"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const capabilityTiles = [
  "Inspections",
  "Field Teams",
  "Compliance",
];

const securityPills = ["ISO 45001", "SOC 2 Type II", "AES-256", "OSHA Ready"];

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [portalRole, setPortalRole] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleCreateAccount() {
    if (!agreed) {
      alert("You must accept the agreement before creating an account.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      alert("Email and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const session = data.session;

    if (session?.access_token) {
      await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.08),_transparent_22%),linear-gradient(180deg,_#0a1018_0%,_#0f1726_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-amber-500/18 bg-[#121826] shadow-[0_34px_90px_rgba(0,0,0,0.45)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden border-b border-amber-500/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.10),_transparent_25%),linear-gradient(180deg,_rgba(8,15,26,0.92)_0%,_rgba(12,19,31,0.84)_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[760px] lg:border-b-0 lg:border-r lg:border-r-amber-500/12 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.04)_0%,_transparent_40%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_26%)]" />
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:38px_38px]" />

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 backdrop-blur">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-base font-black text-slate-950 shadow-[0_8px_24px_rgba(245,158,11,0.3)]">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="currentColor"
                    >
                      <path d="M12 2 5 5v6c0 5.2 3.4 10 7 11 3.6-1 7-5.8 7-11V5l-7-3Z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-tight text-white">
                      Safety<span className="text-amber-400">360</span>Docs
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-amber-300">
                      Enterprise Safety Management Platform
                    </div>
                  </div>
                </div>

                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                  Systems live
                </div>
              </div>

              <div className="mt-10 max-w-xl">
                <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-[4.1rem]">
                  <span className="block">Secure.</span>
                  <span className="block text-amber-400">Document.</span>
                  <span className="block">Stay Safe.</span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
                  The complete safety documentation platform trusted by industrial
                  leaders. Manage incidents, inspections, and compliance from one
                  secure command center.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {capabilityTiles.map((tile, index) => (
                  <div
                    key={tile}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 p-3"
                  >
                    <div
                      className={[
                        "h-20 rounded-xl",
                        index === 0
                          ? "bg-[linear-gradient(135deg,_rgba(251,191,36,0.30),_rgba(15,23,42,0.30)),radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_45%)]"
                          : index === 1
                            ? "bg-[linear-gradient(135deg,_rgba(56,189,248,0.26),_rgba(15,23,42,0.24)),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.22),_transparent_45%)]"
                            : "bg-[linear-gradient(135deg,_rgba(148,163,184,0.24),_rgba(245,158,11,0.20)),radial-gradient(circle_at_center,_rgba(255,255,255,0.22),_transparent_50%)]",
                      ].join(" ")}
                    />
                    <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-black/45 px-3 py-2 backdrop-blur">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-white">
                        {tile}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid max-w-md gap-3 sm:grid-cols-2">
                <MetricCard value="98.9%" label="Uptime SLA" />
                <MetricCard value="12K+" label="Active Users" />
                <MetricCard value="4.2M" label="Docs Secured" />
              </div>

              <div className="mt-auto pt-8">
                <div className="flex flex-wrap gap-3">
                  {securityPills.map((pill) => (
                    <div
                      key={pill}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200"
                    >
                      {pill}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center bg-[linear-gradient(180deg,_#151d2c_0%,_#131b29_100%)] px-5 py-7 sm:px-8 lg:px-10">
            <div className="w-full max-w-md">
              <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.02] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="currentColor"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                      Secure Access
                      <br />
                      Portal
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      Sign in to your Safety360Docs workspace.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-slate-900/35 p-1.5">
                  <button
                    type="button"
                    onClick={() => setPortalRole("user")}
                    className={[
                      "rounded-xl px-4 py-3 text-left text-sm font-semibold transition",
                      portalRole === "user"
                        ? "bg-amber-400/12 text-amber-300 ring-1 ring-amber-400/30"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    User
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalRole("admin")}
                    className={[
                      "rounded-xl px-4 py-3 text-left text-sm font-semibold transition",
                      portalRole === "admin"
                        ? "bg-amber-400/12 text-amber-300 ring-1 ring-amber-400/30"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Administrator
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-slate-900/30 p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={[
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      mode === "login"
                        ? "bg-white/8 text-white ring-1 ring-white/10"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={[
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      mode === "signup"
                        ? "bg-white/8 text-white ring-1 ring-white/10"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Create Account
                  </button>
                </div>

                <div className="mt-8 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Employee ID / Email
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/35 px-4 py-3.5 text-slate-300 transition focus-within:border-amber-400/35">
                      <IconMail />
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Password
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/35 px-4 py-3.5 text-slate-300 transition focus-within:border-amber-400/35">
                      <IconLock />
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      />
                      <IconEye />
                    </div>
                  </div>

                  {mode === "signup" ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Confirm Password
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/35 px-4 py-3.5 text-slate-300 transition focus-within:border-amber-400/35">
                        <IconLock />
                        <input
                          type="password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900/40"
                      />
                      <span>Remember this device</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => alert("Password reset flow is not set up yet.")}
                      className="text-sm font-semibold text-amber-300 transition hover:text-amber-200"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {mode === "signup" ? (
                    <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-4">
                      <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
                    </div>
                  ) : null}

                  <button
                    onClick={mode === "login" ? handleLogin : handleCreateAccount}
                    disabled={loading || (mode === "signup" && !agreed)}
                    className="w-full rounded-2xl bg-amber-400 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-[0_16px_36px_rgba(245,158,11,0.26)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? mode === "login"
                        ? "Accessing workspace..."
                        : "Creating account..."
                      : mode === "login"
                        ? "Access Workspace"
                        : "Create Account"}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/8" />
                    <div className="text-sm text-slate-500">or continue with</div>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>

                  <button
                    type="button"
                    onClick={() => alert("Google workspace sign-in is not configured in this build.")}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/35 px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900/55"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900">
                      G
                    </span>
                    Sign in with Google Workspace
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-500/22 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
                  TLS 1.3 encrypted. Zero-knowledge architecture ready. 2FA supported.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
      <div className="text-3xl font-black tracking-tight text-amber-300">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function IconMail() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v.2l8 5.2 8-5.2V8H4Z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-slate-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
