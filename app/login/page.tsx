"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const highlights = [
  "Centralize project safety records, reviews, and final approvals.",
  "Give teams a clearer workflow from draft intake to completed delivery.",
  "Present a stronger, more professional experience to clients and field teams.",
];

const trustPoints = [
  { label: "Document control", value: "Centralized" },
  { label: "Review workflow", value: "Tracked" },
  { label: "Field readiness", value: "Client-facing" },
];

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_24%),linear-gradient(180deg,_#f7fbff_0%,_#eef4fb_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_30px_90px_rgba(15,23,42,0.10)] backdrop-blur sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,_#0f172a_0%,_#12304f_52%,_#0f172a_100%)] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.22),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.12),_transparent_26%)]" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/16 text-lg font-black uppercase tracking-[0.18em] text-sky-200 ring-1 ring-white/10">
                S3
              </div>
              <div>
                <div className="text-3xl font-black tracking-tight text-white">
                  Safety360Docs
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.34em] text-sky-300">
                  Safety Management Platform
                </div>
              </div>
            </div>

            <div className="mt-10 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">
                Professional Document Delivery
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                Present a safety platform that looks ready for serious work.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Safety360Docs helps teams organize submissions, approvals, and final
                deliverables in one polished workspace built for operations, clients,
                and project visibility.
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/18 text-sm font-black text-sky-200">
                    +
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/6 p-4">
                <Image
                  src="/login-hero.svg"
                  alt="Abstract illustration of documents, compliance, and safety workflow"
                  width={720}
                  height={520}
                  className="h-auto w-full rounded-[1.25rem]"
                  priority
                />
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {trustPoints.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    {item.label}
                  </div>
                  <div className="mt-2 text-base font-bold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-xl">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                    Secure Access
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {mode === "login"
                      ? "Sign in to manage approvals, uploads, and project-ready safety documents."
                      : "Start using Safety360Docs with a cleaner, more client-ready document workflow."}
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-right sm:block">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">
                    Platform
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    Ready for teams
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={[
                    "rounded-xl px-4 py-3 text-sm font-semibold transition",
                    mode === "login"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
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
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  Create Account
                </button>
              </div>

              <div className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white"
                  />
                </div>

                {mode === "signup" ? (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white"
                    />
                  </div>
                ) : null}

                {mode === "signup" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
                  </div>
                ) : null}

                <button
                  onClick={mode === "login" ? handleLogin : handleCreateAccount}
                  disabled={loading || (mode === "signup" && !agreed)}
                  className="mt-2 w-full rounded-2xl bg-sky-600 py-3.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(2,132,199,0.24)] transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Login"
                      : "Create Account"}
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <MiniFeature
                  title="Client-ready"
                  text="A cleaner experience for teams and stakeholders."
                />
                <MiniFeature
                  title="Organized"
                  text="Upload, review, and archive from one workspace."
                />
                <MiniFeature
                  title="Trackable"
                  text="Keep approvals and deliverables visible."
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniFeature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-sm font-bold text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{text}</div>
    </div>
  );
}
