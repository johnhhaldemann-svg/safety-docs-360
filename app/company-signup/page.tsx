"use client";

import Link from "next/link";
import { useState } from "react";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";

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
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("success");

  function formatEnvDetails(details?: {
    url?: boolean;
    anonKey?: boolean;
    serviceRoleKey?: boolean;
    sources?: {
      url?: string | null;
      anonKey?: string | null;
      serviceRoleKey?: string | null;
    };
  } | null) {
    if (!details) return "";

    const urlText = details.url
      ? `URL from ${details.sources?.url ?? "unknown source"}`
      : "URL missing";
    const anonText = details.anonKey
      ? `anon key from ${details.sources?.anonKey ?? "unknown source"}`
      : "anon key missing";
    const serviceRoleText = details.serviceRoleKey
      ? `service role from ${details.sources?.serviceRoleKey ?? "unknown source"}`
      : "service role missing";

    return ` Server check: ${urlText}; ${anonText}; ${serviceRoleText}.`;
  }

  async function handleCreateCompanyAccount() {
    setMessage("");

    if (
      !companyName.trim() ||
      !industry.trim() ||
      !phone.trim() ||
      !fullName.trim() ||
      !email.trim() ||
      !password.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !stateRegion.trim() ||
      !postalCode.trim() ||
      !country.trim()
    ) {
      setMessageTone("error");
      setMessage(
        "Company details, primary contact details, and address fields are required."
      );
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
        agreed,
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | {
          error?: string;
          message?: string;
          details?: {
            url?: boolean;
            anonKey?: boolean;
            serviceRoleKey?: boolean;
            sources?: {
              url?: string | null;
              anonKey?: string | null;
              serviceRoleKey?: string | null;
            };
          };
        }
      | null;

    setLoading(false);

    if (!res.ok) {
      setMessageTone("error");
      setMessage(
        `${data?.error || "Failed to create the company account."}${formatEnvDetails(
          data?.details
        )}`
      );
      return;
    }

    setMessageTone("success");
    setMessage(
      data?.message ||
        "Company account created. An internal administrator must approve your workspace before sign-in."
    );
    setCompanyName("");
    setIndustry("");
    setPhone("");
    setWebsite("");
    setAddressLine1("");
    setCity("");
    setStateRegion("");
    setPostalCode("");
    setCountry("");
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
            Register your company and launch a dedicated Safety360Docs portal.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            Set up the company once, assign the first company admin, and launch a
            clean workspace where every employee is invited, approved, and managed
            under the same company account.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              {
                step: "01",
                title: "Choose your plan",
                body: "Start with the paid workspace setup that fits your company operations.",
              },
              {
                step: "02",
                title: "Create the company workspace",
                body: "Enter the core company details that will appear across your company dashboard and admin records.",
              },
              {
                step: "03",
                title: "Assign the first company admin",
                body: "This person becomes the owner of employee invites, company approvals, and workspace access.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/16 text-sm font-black text-sky-200">
                  {item.step}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-emerald-500/18 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            After approval, the first company admin signs in, opens the company
            workspace, and invites employees under the same company profile.
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/8 bg-[#121826] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.32)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            New Company Account
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
            Create company account
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Register the company first, then assign the primary company admin who will
            manage users after approval.
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
            <div className="rounded-3xl border border-white/8 bg-slate-900/28 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/16 text-xs font-black text-sky-200">
                  1
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                    Company Details
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    These details define the company workspace and the information shown in
                    the company dashboard.
                  </p>
                </div>
              </div>
            </div>
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="text"
              placeholder="Industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="tel"
              placeholder="Company phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="url"
              placeholder="Website (optional)"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="text"
              placeholder="Address line 1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
              />
              <input
                type="text"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
              />
              <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
              />
            </div>
            <div className="rounded-3xl border border-white/8 bg-slate-900/28 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/16 text-xs font-black text-sky-200">
                  2
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                    Primary Company Admin
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    This becomes the first company user and can invite employees once the
                    workspace is approved.
                  </p>
                </div>
              </div>
            </div>
            <input
              type="text"
              placeholder="Primary company admin full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#101827] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/35"
            />
            <input
              type="email"
              placeholder="Primary company admin email"
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

            <div className="rounded-3xl border border-white/8 bg-slate-900/28 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/16 text-xs font-black text-sky-200">
                  3
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                    Agreements & Launch
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Confirm the platform terms, then send the company workspace for approval.
                  </p>
                </div>
              </div>
              <LegalAcceptanceBlock checked={agreed} onChange={setAgreed} compact />
            </div>

            <button
              onClick={() => void handleCreateCompanyAccount()}
              disabled={loading || !agreed}
              className="rounded-2xl bg-sky-500 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating company workspace..." : "Register Company"}
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
