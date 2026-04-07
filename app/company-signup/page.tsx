"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

type CompanySignupResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  warning?: string | null;
};

const planOptions = [
  {
    value: "Starter",
    title: "Starter",
    detail: "Small team rollout with core company workspace access.",
  },
  {
    value: "Pro",
    title: "Pro",
    detail: "Company workspace, employee invites, and broader document access.",
  },
  {
    value: "Enterprise",
    title: "Enterprise",
    detail: "Full company rollout with internal coordination and long-term scale.",
  },
];

export default function CompanySignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [planName, setPlanName] = useState("Pro");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "warning">(
    "success"
  );
  const [completed, setCompleted] = useState(false);

  const submitLabel = useMemo(() => {
    if (loading) return "Creating Company Account...";
    if (completed) return "Company Account Submitted";
    return "Create Company Account";
  }, [completed, loading]);

  async function handleSubmit() {
    setMessage("");
    setCompleted(false);

    if (!agreed) {
      setMessageTone("error");
      setMessage("You must accept the agreement before creating a company account.");
      return;
    }

    if (
      !companyName.trim() ||
      !industry.trim() ||
      !phone.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !stateRegion.trim() ||
      !postalCode.trim() ||
      !country.trim() ||
      !fullName.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setMessageTone("error");
      setMessage("Company details, address, owner name, email, and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageTone("error");
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/company-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          industry,
          phone,
          website,
          addressLine1,
          city,
          stateRegion,
          postalCode,
          country,
          fullName,
          email,
          password,
          planName,
          agreed,
        }),
      });

      const data = (await res.json().catch(() => null)) as CompanySignupResponse | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create the company account.");
        setLoading(false);
        return;
      }

      setMessageTone(data?.warning ? "warning" : "success");
      setMessage(
        data?.warning
          ? `${data.message ?? "Company account submitted."} ${data.warning}`
          : data?.message ??
              "Company account created. Once approved, sign in with this same email to open the workspace."
      );
      setCompleted(true);
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to create the company account."
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_24%),linear-gradient(180deg,_#091220_0%,_#0f1726_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full gap-6 rounded-[2rem] border border-white/8 bg-[#121826] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.32)] lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <section className="rounded-[1.75rem] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_rgba(8,15,26,0.92)_0%,_rgba(12,19,31,0.88)_100%)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Company Workspace
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Create the company account once, then wait for approval.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
              This is now the single owner onboarding flow. The company owner creates one
              account, submits the company request, gets approved once, and then signs back
              in with the same email to open the company workspace.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  step: "01",
                  title: "Create the owner account",
                  body: "Use the future company owner email once. That same account will be linked during approval.",
                },
                {
                  step: "02",
                  title: "Internal approval",
                  body: "Your internal admin reviews the company request and activates the company workspace.",
                },
                {
                  step: "03",
                  title: "Sign in with the same email",
                  body: "After approval, the owner signs in with that same account. No second signup should be needed.",
                },
                {
                  step: "04",
                  title: "Set up billing and credits",
                  body: "Once the workspace is active, company admins can review invoices, buy marketplace credits, and manage subscription or seat pricing from the company workspace.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sm font-black text-sky-200">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-base font-bold text-white">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-amber-400/18 bg-amber-400/8 p-5 text-sm leading-7 text-amber-100">
              One email can only be used for one real account. If the company request is still
              pending, the app will tell you to wait instead of creating duplicate company
              signup tickets. After approval, billing, credits, and subscriptions are managed
              from the company workspace rather than by creating a second account.
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Already have an account? Sign in
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Back to Website
              </Link>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/8 bg-slate-900/90 p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Company Owner Signup
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-white">
              Create your company account
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This owner account will become the company admin after approval.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Company name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="tel"
                placeholder="Company phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="url"
                placeholder="Website (optional)"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Address line 1"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500 md:col-span-2"
              />
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Owner account
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Owner full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                />
                <input
                  type="email"
                  placeholder="Owner email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Plan
              </div>
              <div className="mt-3 space-y-3">
                {planOptions.map((option) => {
                  const active = planName === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPlanName(option.value)}
                      className={[
                        "w-full rounded-2xl border px-4 py-4 text-left transition",
                        active
                          ? "border-sky-300 bg-sky-950/35 shadow-sm"
                          : "border-slate-700/80 bg-slate-900/90 hover:border-sky-500/35 hover:bg-sky-800/50",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-slate-100">{option.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
            </div>

            {message ? (
              <div
                className={[
                  "mt-6 rounded-2xl border px-4 py-3 text-sm",
                  messageTone === "error"
                    ? "border-red-500/35 bg-red-950/40 text-red-700"
                    : messageTone === "warning"
                      ? "border-amber-500/35 bg-amber-950/40 text-amber-100"
                      : "border-emerald-500/30 bg-emerald-950/35 text-emerald-700",
                ].join(" ")}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || (completed && messageTone !== "error")}
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Go to Login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
