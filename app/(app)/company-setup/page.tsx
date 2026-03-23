"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
        | { error?: string; warning?: string | null; message?: string }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create the company workspace.");
        setLoading(false);
        return;
      }

      setMessageTone(data?.warning ? "warning" : "success");
      setMessage(
        data?.warning
          ? `${data.message ?? "Company workspace created."} ${data.warning}`
          : data?.message ?? "Company workspace created successfully."
      );
      window.location.href = "/company-users";
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
        eyebrow="Company Setup"
        title="Create your company workspace"
        description="Set up the company once, choose the plan, and unlock the company admin tools that let you invite employees and control company access."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "01",
            title: "Your account is ready",
            body: "You already have a Safety360Docs account. This step creates the shared company workspace around it.",
          },
          {
            step: "02",
            title: "Set the company profile",
            body: "These details power the company dashboard, workspace identity, and admin oversight.",
          },
          {
            step: "03",
            title: "Invite employees",
            body: "Once this workspace is live, invite employees from the company access page and approve them there.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700">
                {item.step}
              </div>
              <div>
                <div className="text-base font-bold text-slate-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Company profile"
        description="Use the same setup style that other SaaS products use: account first, then workspace creation, then employee invites."
      >
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Primary Contact
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{contactName || "Account owner"}</div>
              <div className="mt-1 text-sm text-slate-500">{contactEmail || "Signed-in account"}</div>
            </div>

            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="tel"
              placeholder="Company phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="url"
              placeholder="Website (optional)"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Address line 1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Choose Plan
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
                          ? "border-sky-300 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-slate-900">{option.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">What happens next</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-500">
                <p>1. Your company workspace is created under the signed-in account.</p>
                <p>2. Your account becomes the company admin for that workspace.</p>
                <p>3. You land in Company Access to invite employees and approve who can join.</p>
              </div>
            </div>

            {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

            <button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={loading}
              className="w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {loading ? "Creating company workspace..." : "Create Company Workspace"}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
