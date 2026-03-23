"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
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
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get("email") ?? "";
  const inviteMode = searchParams.get("mode") === "signup";
  const inviteType = searchParams.get("invite");
  const inviteSignupEnabled = inviteMode && !!invitedEmail;
  const inviteNotice =
    inviteType === "company" && invitedEmail
      ? "Your company invite is ready. Create your account with this invited email address to join the workspace automatically."
      : "";

  const [mode, setMode] = useState<"login" | "signup">(inviteSignupEnabled ? "signup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState(inviteNotice);
  const [formTone, setFormTone] = useState<"error" | "success">("success");

  async function handleLogin() {
    setFormMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setFormTone("error");
      setFormMessage(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleCreateAccount() {
    setFormMessage("");

    if (!agreed) {
      setFormTone("error");
      setFormMessage("You must accept the agreement before creating an account.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFormTone("error");
      setFormMessage("Full name, email, and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setFormTone("error");
      setFormMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName,
        email,
        password,
        agreed,
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    setLoading(false);

    if (!res.ok) {
      setFormTone("error");
      setFormMessage(data?.error || "Failed to create your account.");
      return;
    }

    setMode("login");
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setAgreed(false);
    setFormTone("success");
    setFormMessage(
      data?.message ||
        "Account created. An administrator must approve your access before you can sign in."
    );
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

                {inviteSignupEnabled ? (
                  <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-slate-900/30 p-1.5">
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
                      Accept Invite
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-white/8 bg-slate-900/30 px-4 py-4 text-sm text-slate-300">
                    Employee access is invite-only. Your company admin must invite you
                    before you can create an account.
                  </div>
                )}

                <div className="mt-8 space-y-4">
                  {formMessage ? (
                    <div
                      className={[
                        "rounded-2xl border px-4 py-3 text-sm",
                        formTone === "error"
                          ? "border-red-500/25 bg-red-500/10 text-red-200"
                          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
                      ].join(" ")}
                    >
                      {formMessage}
                    </div>
                  ) : null}

                  <div>
                    {mode === "signup" ? (
                      <>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                          Full Name
                        </label>
                        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-slate-300 shadow-inner transition focus-within:border-amber-400/35 focus-within:bg-[#0d1521]">
                          <IconUser />
                          <input
                            type="text"
                            placeholder="Your full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="auth-input w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                          />
                        </div>
                      </>
                    ) : null}

                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Employee ID / Email
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-slate-300 shadow-inner transition focus-within:border-amber-400/35 focus-within:bg-[#0d1521]">
                      <IconMail />
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Password
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-slate-300 shadow-inner transition focus-within:border-amber-400/35 focus-within:bg-[#0d1521]">
                      <IconLock />
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="auth-input w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      />
                      <IconEye />
                    </div>
                  </div>

                  {mode === "signup" ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Confirm Password
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-slate-300 shadow-inner transition focus-within:border-amber-400/35 focus-within:bg-[#0d1521]">
                        <IconLock />
                        <input
                          type="password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="auth-input w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
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
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-slate-900/30 px-4 py-3 text-sm text-slate-400">
                    Need help accessing your workspace? Contact your internal administrator
                    or company admin to reset your password and confirm your account status.
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
                        : "Accept Invite"}
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-emerald-500/22 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
                  TLS 1.3 encrypted. Zero-knowledge architecture ready. 2FA supported.
                </div>

                <div className="mt-5 rounded-2xl border border-sky-500/18 bg-sky-500/10 px-4 py-4 text-sm text-sky-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-sky-200">Need a new company workspace?</p>
                      <p className="mt-1 text-sky-100/90">
                        Register the company first, then assign the first company admin.
                      </p>
                    </div>
                    <Link
                      href="/company-signup"
                      className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                    >
                      Register Company
                    </Link>
                  </div>
                </div>

                {!inviteSignupEnabled ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/18 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                    If you are an employee joining an existing company, ask your company
                    admin to send you an invite first.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.08),_transparent_22%),linear-gradient(180deg,_#0a1018_0%,_#0f1726_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-md rounded-[1.8rem] border border-white/8 bg-[#121826] p-8 text-center text-slate-300 shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
          Loading secure access portal...
        </div>
      </div>
    </main>
  );
}

function IconUser() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
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
