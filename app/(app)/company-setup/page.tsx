"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

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
        title="Attach a company workspace to this account"
        description="Use this path only when you already have a signed-in account. New company owners without an account should use the public company workspace request instead."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "01",
            title: "Create the workspace",
            body: "Your personal account is already in place. This step attaches the workspace request to the signed-in owner account.",
          },
          {
            step: "02",
            title: "Confirm company details",
            body: "These details power the company dashboard, workspace identity, and internal support view.",
          },
          {
            step: "03",
            title: "Start from Command Center",
            body: "After approval, sign back in with this same email and use the dashboard checklist and Command Center as the launch path.",
          },
          {
            step: "04",
            title: "Invite, add jobsites, and create documents",
            body: "Use the first-run checklist to invite the team, add a jobsite, and create the first document record.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent-primary-10,rgba(37,99,235,0.10))] text-sm font-black text-[var(--app-accent-primary)]">
                {item.step}
              </div>
              <div>
                <div className="text-base font-bold text-[var(--app-text-strong)]">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Set Up Company Workspace"
        description="Fill in the company details once, choose the plan, and submit the workspace request attached to this signed-in account."
      >
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Company Owner
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{contactName || "Account owner"}</div>
              <div className="mt-1 text-sm text-[var(--app-text)]">{contactEmail || "Signed-in account"}</div>
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Step 1
              </div>
              <div className="mt-2 text-base font-bold text-[var(--app-text-strong)]">Company details</div>
              <p className="mt-1 text-sm text-[var(--app-text)]">
                These details will appear across the company workspace, internal admin views, and employee invites.
              </p>
            </div>

            <input
              type="text"
              aria-label="Company name"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
            />
            <input
              type="text"
              aria-label="Industry"
              placeholder="Industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
            />
            <input
              type="tel"
              aria-label="Company phone"
              placeholder="Company phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
            />
            <input
              type="url"
              aria-label="Website (optional)"
              placeholder="Website (optional)"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
            />
            <input
              type="text"
              aria-label="Address line 1"
              placeholder="Address line 1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                aria-label="City"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
              />
              <input
                type="text"
                aria-label="State or region"
                placeholder="State / Region"
                value={stateRegion}
                onChange={(event) => setStateRegion(event.target.value)}
                className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                aria-label="Postal code"
                placeholder="Postal code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
              />
              <input
                type="text"
                aria-label="Country"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Step 2
              </div>
              <div className="mt-2 text-base font-bold text-[var(--app-text-strong)]">Internal onboarding terms</div>
              <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                A Platform Admin will assign the internal tier, price, included jobsites, users,
                enabled feature modules, add-ons, and draft invoice after this request is submitted.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Step 3
              </div>
              <div className="mt-2 text-base font-bold text-[var(--app-text-strong)]">Launch workspace</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--app-text)]">
                <p>1. Your company workspace request is submitted under the signed-in account.</p>
                <p>2. Internal admin approves the company and activates the workspace.</p>
                <p>3. You sign back in with this same email and the company workspace opens on that account.</p>
                <p>4. Company admins can then manage billing, invoices, and marketplace purchases from the company workspace.</p>
                <p>
                  Do not create another account after approval. The same owner email is attached automatically.
                </p>
              </div>
            </div>

            {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

            {launchMode === "request" ? (
              <div className="rounded-2xl border border-[var(--semantic-warning-border,rgba(217,164,65,0.35))] bg-[var(--semantic-warning-bg)] px-4 py-4 text-sm text-[var(--app-text-strong)]">
                <div className="font-semibold">What happens next</div>
                <div className="mt-2 space-y-2 leading-6 text-[var(--app-text)]">
                  <p>1. Your company setup request is now waiting for internal approval.</p>
                  <p>2. Your personal account stays on file under this same email.</p>
                  <p>3. After approval, sign back in with this same email and the company workspace will attach automatically.</p>
                  <p>4. Start with the dashboard launch checklist, then use Command Center as the daily operating hub.</p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={loading || launchMode === "request"}
              className="w-full rounded-2xl bg-[var(--app-accent-primary)] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
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
