"use client";

import Link from "next/link";
import { useState } from "react";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

export default function CompanySignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("success");

  async function handleCreateCompanyAccount() {
    setMessage("");

    if (!companyName.trim() || !fullName.trim() || !email.trim() || !password.trim()) {
      setMessageTone("error");
      setMessage("Company name, full name, email, and password are required.");
      return;
    }

    if (!agreed) {
      setMessageTone("error");
      setMessage("You must accept the agreement before creating a company account.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageTone("error");
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/company-register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName,
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
      setMessageTone("error");
      setMessage(data?.error || "Failed to create the company account.");
      return;
    }

    setMessageTone("success");
    setMessage(
      data?.message ||
        "Company account created. An internal administrator must approve your workspace before sign-in."
    );
    setCompanyName("");
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setAgreed(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_24%),linear-gradient(180deg,_#091220_0%,_#0f1726_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-sky-500/12 bg-[linear-gradient(180deg,_rgba(11,23,39,0.96)_0%,_rgba(14,26,45,0.92)_100%)] p-8 text-white shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-300">
            Company Workspace
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Launch a dedicated company portal inside Safety360Docs.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            Company accounts get their own document library, company user management,
            completed deliverables, and a company-scoped workspace for tracking who
            belongs under each client.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Dedicated company workspace",
              "Company Admin user management",
              "Completed document access",
              "Internal approval before activation",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-100"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-emerald-500/18 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            Once approved, your company admin can invite additional company users and
            keep all access scoped under the same company record.
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/8 bg-[#121826] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.32)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            New Company Account
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
            Create a company workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This creates the first company admin account for the client workspace.
          </p>

          {message ? (
            <div
              className={[
                "mt-6 rounded-2xl border px-4 py-3 text-sm",
                messageTone === "error"
                  ? "border-red-500/25 bg-red-500/10 text-red-200"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
              ].join(" ")}
            >
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="text"
              placeholder="Company admin full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="email"
              placeholder="Company admin email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />

            <div className="rounded-2xl border border-white/8 bg-slate-900/30 p-4">
              <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
            </div>

            <button
              onClick={() => void handleCreateCompanyAccount()}
              disabled={loading || !agreed}
              className="rounded-2xl bg-sky-500 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating company workspace..." : "Create Company Account"}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/login" className="font-semibold text-sky-300 transition hover:text-sky-200">
              Back to secure access
            </Link>
            <Link href="/" className="font-semibold text-slate-400 transition hover:text-slate-200">
              Back to website
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
