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
    <main id="main-content" className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,125,243,0.14),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#e7f0fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <div className="app-radius-panel grid w-full gap-6 border border-[var(--app-border)] bg-[rgba(248,251,255,0.96)] p-6 shadow-[var(--app-shadow)] lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <section className="app-radius-card border border-[var(--app-border)] bg-[radial-gradient(circle_at_top_left,_rgba(79,125,243,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(234,241,255,0.96)_100%)] p-6 text-[var(--app-text)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
              Company Workspace
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-5xl">
              Create the company account, then wait for approval.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[var(--app-text)]">
              This is the single owner onboarding flow. The company owner creates one
              account, submits the company request, waits for approval, and then signs back
              in with the same email to open the company workspace.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  step: "01",
                  title: "Create the owner account",
                  body: "Use the future company owner email once. That same account is linked during approval.",
                },
                {
                  step: "02",
                  title: "Internal approval",
                  body: "Your internal admin reviews the company request and activates the company workspace.",
                },
                {
                  step: "03",
                  title: "Sign in with the same email",
                  body: "After approval, the owner signs in with that same account. No second sign-up is needed.",
                },
                {
                  step: "04",
                  title: "Set up billing and credits",
                  body: "Once the workspace is active, company admins can review invoices, buy marketplace credits, and manage subscription and seat pricing from the company workspace.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-3xl border border-[var(--app-border)] bg-white/78 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent-primary-soft)] text-sm font-black text-[var(--app-accent-primary)]">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-base font-bold text-[var(--app-text-strong)]">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="app-warning-panel mt-8 rounded-3xl border-amber-300/70 bg-amber-50 p-5 text-sm leading-7 text-[var(--app-text-strong)]">
              One email can only be used for one real account. If the company request is still
              pending, the app will tell you to wait instead of creating duplicate company
              sign-up requests. After approval, billing, credits, and subscriptions are managed
              from the company workspace rather than by creating a second account.
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="app-btn-secondary inline-flex items-center justify-center px-5 py-3 text-sm transition">
                Already have an account? Sign in
              </Link>
              <Link href="/" className="app-btn-secondary inline-flex items-center justify-center px-5 py-3 text-sm transition">
                Back to site
              </Link>
            </div>
          </section>

          <section className="app-radius-card border border-[var(--app-border)] bg-white/80 p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-600">
              Company Owner Signup
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-[var(--app-text-strong)]">
              Create your company account
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This owner account becomes the company admin after approval.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                type="text"
                aria-label="Company name"
                placeholder="Company name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="app-form-input"
              />
              <input
                type="text"
                aria-label="Industry"
                placeholder="Industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                className="app-form-input"
              />
              <input
                type="tel"
                aria-label="Company phone"
                placeholder="Company phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="app-form-input"
              />
              <input
                type="url"
                aria-label="Website (optional)"
                placeholder="Website (optional)"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className="app-form-input"
              />
              <input
                type="text"
                aria-label="Address line 1"
                placeholder="Address line 1"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                className="app-form-input md:col-span-2"
              />
              <input
                type="text"
                aria-label="City"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="app-form-input"
              />
              <input
                type="text"
                aria-label="State or region"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="app-form-input"
              />
              <input
                type="text"
                aria-label="Postal code"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="app-form-input"
              />
              <input
                type="text"
                aria-label="Country"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="app-form-input"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                Owner account
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  aria-label="Owner full name"
                  placeholder="Owner full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="app-form-input"
                />
                <input
                  type="email"
                  aria-label="Owner email"
                  autoComplete="email"
                  placeholder="Owner email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="app-form-input"
                />
                <input
                  type="password"
                  aria-label="Password"
                  autoComplete="new-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="app-form-input"
                />
                <input
                  type="password"
                  aria-label="Confirm password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="app-form-input"
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
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
                          ? "border-[rgba(79,125,243,0.28)] bg-[var(--app-accent-primary-soft)] shadow-sm"
                          : "border-[var(--app-border)] bg-white hover:border-[rgba(79,125,243,0.28)] hover:bg-[var(--app-accent-primary-soft)]",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{option.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
              <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
            </div>

            {message ? (
              <div
                className={[
                  "mt-6 rounded-2xl px-4 py-3 text-sm",
                  messageTone === "error"
                    ? "app-danger-panel"
                    : messageTone === "warning"
                      ? "app-warning-panel"
                      : "app-success-panel",
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
                className="app-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm app-shadow-action transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
              <Link href="/login" className="app-btn-secondary inline-flex items-center justify-center px-5 py-3 text-sm transition">
                Go to Login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
