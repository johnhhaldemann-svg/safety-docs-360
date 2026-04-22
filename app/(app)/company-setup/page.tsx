"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

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

export default function CompanySetupPage() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [planName, setPlanName] = useState("Pro");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [launchMode, setLaunchMode] = useState<"live" | "request" | null>(null);
  const [messageTone, setMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return;
      }

      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            user?: {
              email?: string;
              companyName?: string | null;
              profile?: {
                fullName?: string | null;
              } | null;
              companyProfile?: {
                name?: string | null;
                industry?: string | null;
                phone?: string | null;
                website?: string | null;
                address_line_1?: string | null;
                city?: string | null;
                state_region?: string | null;
                postal_code?: string | null;
                country?: string | null;
                primary_contact_name?: string | null;
                primary_contact_email?: string | null;
              } | null;
            };
          }
        | null;

      if (!res.ok) {
        return;
      }

      setContactEmail(data?.user?.email ?? "");
      setContactName(
        data?.user?.companyProfile?.primary_contact_name ??
          data?.user?.profile?.fullName ??
          data?.user?.email?.split("@")[0] ??
          ""
      );
      setCompanyName(data?.user?.companyProfile?.name ?? "");
      setIndustry(data?.user?.companyProfile?.industry ?? "");
      setPhone(data?.user?.companyProfile?.phone ?? "");
      setWebsite(data?.user?.companyProfile?.website ?? "");
      setAddressLine1(data?.user?.companyProfile?.address_line_1 ?? "");
      setCity(data?.user?.companyProfile?.city ?? "");
      setStateRegion(data?.user?.companyProfile?.state_region ?? "");
      setPostalCode(data?.user?.companyProfile?.postal_code ?? "");
      setCountry(data?.user?.companyProfile?.country ?? "");
      setContactEmail(
        data?.user?.companyProfile?.primary_contact_email ?? data?.user?.email ?? ""
      );
    })();
  }, []);

  async function handleCreateWorkspace() {
    if (
      !companyName.trim() ||
      !industry.trim() ||
      !phone.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !stateRegion.trim() ||
      !postalCode.trim() ||
      !country.trim()
    ) {
      setMessageTone("error");
      setMessage("Company details, contact information, and address fields are required.");
      return;
    }

    setLoading(true);
    setMessage("");
    setLaunchMode(null);
    setMessageTone("neutral");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in before creating your company workspace.");
      }

      const res = await fetch("/api/company/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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
          planName,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            warning?: string | null;
            message?: string;
            mode?: "live" | "request";
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create the company workspace.");
        setLoading(false);
        return;
      }

      setLaunchMode(data?.mode ?? null);
      setMessageTone(data?.warning ? "warning" : "success");
      setMessage(
        data?.warning
          ? `${data.message ?? "Company workspace request submitted."} ${data.warning}`
          : data?.message ?? "Company workspace created successfully."
      );

      setLoading(false);
      return;
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to create the company workspace."
      );
      setLoading(false);
      return;
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Workspace"
        title="Set up your company"
        description="Your field talent profile is in place. Use this step to submit the company workspace request that will be reviewed and activated by your internal admin."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "01",
            title: "Create the workspace",
            body: "Your personal account is already in place. This step submits the company workspace request under that same owner account.",
          },
          {
            step: "02",
            title: "Confirm company details",
            body: "These details power the company dashboard, workspace identity, and internal support view.",
          },
          {
            step: "03",
            title: "Invite and approve employees",
            body: "After approval, sign back in with this same email and start inviting employees from the company workspace.",
          },
          {
            step: "04",
            title: "Manage billing and credits",
            body: "Once the company workspace is live, company admins can open Billing to review invoices and purchase marketplace credits for completed documents.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-300">
                {item.step}
              </div>
              <div>
                <div className="text-base font-bold text-white">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Set Up Company Workspace"
        description="Fill in the company details once, choose the plan, and submit the company workspace request your team will use after approval."
      >
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Company Owner
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{contactName || "Account owner"}</div>
              <div className="mt-1 text-sm text-slate-500">{contactEmail || "Signed-in account"}</div>
            </div>

            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Step 1
              </div>
              <div className="mt-2 text-base font-bold text-slate-100">Company details</div>
              <p className="mt-1 text-sm text-slate-500">
                These details will appear across the company workspace, internal admin views, and employee invites.
              </p>
            </div>

            <input
              type="text"
              aria-label="Company name"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              aria-label="Industry"
              placeholder="Industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="tel"
              aria-label="Company phone"
              placeholder="Company phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="url"
              aria-label="Website (optional)"
              placeholder="Website (optional)"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              aria-label="Address line 1"
              placeholder="Address line 1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                aria-label="City"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                aria-label="State or region"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                aria-label="Postal code"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                aria-label="Country"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Step 2
              </div>
              <div className="mt-2 text-base font-bold text-slate-100">Choose plan</div>
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

            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Step 3
              </div>
              <div className="mt-2 text-base font-bold text-slate-100">Launch workspace</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-500">
                <p>1. Your company workspace request is submitted under the signed-in account.</p>
                <p>2. Internal admin approves the company and activates the workspace.</p>
                <p>3. You sign back in with this same email and the company workspace opens on that account.</p>
                <p>4. Company admins can then manage billing, invoices, and marketplace credits from the company workspace.</p>
                <p>
                  Do not create another account after approval. The same owner email is attached automatically.
                </p>
              </div>
            </div>

            {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

            {launchMode === "request" ? (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 px-4 py-4 text-sm text-amber-900">
                <div className="font-semibold">What happens next</div>
                <div className="mt-2 space-y-2 leading-6">
                  <p>1. Your company setup request is now waiting for internal approval.</p>
                  <p>2. Your personal account stays on file under this same email.</p>
                  <p>3. After approval, sign back in with this same email and the company workspace will attach automatically.</p>
                  <p>4. Once active, company admins can buy marketplace credits and review billing from the company workspace.</p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={loading || launchMode === "request"}
              className="w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {loading
                ? "Submitting company workspace request..."
                : launchMode === "request"
                  ? "Workspace Request Submitted"
                  : "Submit Company Workspace Request"}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
