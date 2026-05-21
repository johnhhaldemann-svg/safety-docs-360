"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";
import type { CompanyProfile } from "@/components/company-workspace/useCompanyWorkspaceData";

type PilotCompanyProfile = CompanyProfile & {
  pilot_trial_ends_at?: string | null;
  pilot_converted_at?: string | null;
};

const supabase = getSupabaseBrowserClient();

function isPilotMode(profile: PilotCompanyProfile | null): profile is PilotCompanyProfile {
  if (!profile) return false;
  return Boolean(profile.pilot_trial_ends_at) && !profile.pilot_converted_at;
}

function pilotTrialMessage(endsAt: string) {
  const endMs = new Date(endsAt).getTime();
  const days = Math.ceil((endMs - Date.now()) / 86400000);
  if (days > 1) {
    return { tone: "info" as const, text: `${days} days remaining in your pilot trial.` };
  }
  if (days === 1) {
    return { tone: "warning" as const, text: "Last day of your pilot trial." };
  }
  if (days === 0) {
    return { tone: "warning" as const, text: "Your pilot trial ends today." };
  }
  return {
    tone: "error" as const,
    text: "Your pilot trial window has passed. Update your company details and confirm your profile when ready.",
  };
}

export function PilotAccountPanel({
  companyProfile,
  onUpdated,
}: {
  companyProfile: PilotCompanyProfile | null;
  onUpdated?: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isPilotMode(companyProfile)) return;
    setName(companyProfile.name ?? "");
    setIndustry(companyProfile.industry ?? "");
    setPhone(companyProfile.phone ?? "");
    setWebsite(companyProfile.website ?? "");
    setAddressLine1(companyProfile.address_line_1 ?? "");
    setCity(companyProfile.city ?? "");
    setStateRegion(companyProfile.state_region ?? "");
    setPostalCode(companyProfile.postal_code ?? "");
    setCountry(companyProfile.country ?? "");
    setPrimaryContactName(companyProfile.primary_contact_name ?? "");
    setPrimaryContactEmail(companyProfile.primary_contact_email ?? "");
  }, [companyProfile]);

  if (!isPilotMode(companyProfile) || !companyProfile.pilot_trial_ends_at) {
    return null;
  }

  const trial = pilotTrialMessage(companyProfile.pilot_trial_ends_at);

  async function save(completePilot: boolean) {
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sign in again to update your company profile.");
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Company name is required.");
        return;
      }

      const res = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          industry,
          phone,
          website,
          addressLine1,
          city,
          stateRegion,
          postalCode,
          country,
          primaryContactName,
          primaryContactEmail,
          completePilot,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error?.trim() || "Could not save company profile.");
        return;
      }

      setSuccess(
        completePilot
          ? "Profile saved. Your workspace is no longer in pilot placeholder mode."
          : "Changes saved."
      );
      await onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Pilot workspace — confirm company details"
      description="Your account is in a pilot period. You can replace placeholder information with your real company profile at any time; when you are ready, confirm to exit pilot mode."
      aside={
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
          Trial
        </span>
      }
    >
      <div className="space-y-4">
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            trial.tone === "error"
              ? "border-red-500/40 bg-red-950/35 text-red-100"
              : trial.tone === "warning"
                ? "border-amber-500/40 bg-amber-950/40 text-amber-100"
                : "border-sky-500/35 bg-sky-950/30 text-sky-100"
          }`}
        >
          {trial.text}
        </div>

        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        {success ? <InlineMessage tone="success">{success}</InlineMessage> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Company name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Industry</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Website</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="sm:col-span-2 grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Street address</span>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">State / region</span>
            <input
              value={stateRegion}
              onChange={(e) => setStateRegion(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Postal code</span>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Country</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Primary contact name</span>
            <input
              value={primaryContactName}
              onChange={(e) => setPrimaryContactName(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Primary contact email</span>
            <input
              type="email"
              value={primaryContactEmail}
              onChange={(e) => setPrimaryContactEmail(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save progress"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save and exit pilot mode"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
