"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type ProfileForm = {
  name: string;
  industry: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  primaryContactEmail: string;
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  industry: "",
  phone: "",
  website: "",
  addressLine1: "",
  city: "",
  stateRegion: "",
  postalCode: "",
  country: "",
  primaryContactName: "",
  primaryContactEmail: "",
};

const FIELDS: Array<{ key: keyof ProfileForm; label: string; type?: string; full?: boolean }> = [
  { key: "name", label: "Company name" },
  { key: "industry", label: "Industry" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "website", label: "Website", type: "url" },
  { key: "primaryContactName", label: "Primary contact name" },
  { key: "primaryContactEmail", label: "Primary contact email", type: "email" },
  { key: "addressLine1", label: "Address", full: true },
  { key: "city", label: "City" },
  { key: "stateRegion", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)]";

type PilotInfo = { trialEndsAt: string | null; convertedAt: string | null };

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function CompanyProfileEditor() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [pilot, setPilot] = useState<PilotInfo>({ trialEndsAt: null, convertedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessage({ tone: "error", text: "Sign in to edit your company profile." });
        setLoading(false);
        return;
      }
      const res = await fetch("/api/company/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            profile?: Partial<ProfileForm> & { logoDataUrl?: string; logoFileName?: string };
            pilot?: PilotInfo;
            error?: string;
          }
        | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error || "Could not load company profile." });
        setLoading(false);
        return;
      }
      const { logoDataUrl: loadedLogo, logoFileName: loadedLogoName, ...profileFields } =
        data?.profile ?? {};
      setForm({ ...EMPTY_FORM, ...profileFields });
      setLogoDataUrl(loadedLogo ?? "");
      setLogoFileName(loadedLogoName ?? "");
      setPilot(data?.pilot ?? { trialEndsAt: null, convertedAt: null });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load company profile.",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessage({ tone: "error", text: "Sign in to save your company profile." });
        setSaving(false);
        return;
      }
      if (!form.name.trim()) {
        setMessage({ tone: "error", text: "Company name is required." });
        setSaving(false);
        return;
      }
      const res = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, logoDataUrl, logoFileName }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "error", text: data?.error || "Could not save company profile." });
        setSaving(false);
        return;
      }
      setMessage({ tone: "success", text: "Company profile saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save company profile.",
      });
    }
    setSaving(false);
  }, [form, logoDataUrl, logoFileName]);

  const handleLogoChange = useCallback((file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) {
      setMessage({ tone: "error", text: "Logo must be a PNG, JPG, WebP, GIF, or SVG." });
      return;
    }
    if (file.size > 1_500_000) {
      setMessage({ tone: "error", text: "Logo must be under 1.5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === "string" ? reader.result : "");
      setLogoFileName(file.name);
      setMessage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleConvertPilot = useCallback(async () => {
    setConverting(true);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessage({ tone: "error", text: "Sign in to convert your pilot." });
        setConverting(false);
        return;
      }
      const res = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ completePilot: true }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "error", text: data?.error || "Could not convert the pilot." });
        setConverting(false);
        return;
      }
      setMessage({ tone: "success", text: "Pilot converted — thanks for joining!" });
      await load();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not convert the pilot.",
      });
    }
    setConverting(false);
  }, [load]);

  const pilotDaysLeft = daysUntil(pilot.trialEndsAt);
  const inPilot = Boolean(pilot.trialEndsAt) && !pilot.convertedAt;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Profile"
        title="Company details"
        description="Keep your company identity current — it appears on generated documents, reports, invites, and billing records."
        actions={
          <Link
            href="/safe-predict/get-started"
            className="rounded-xl border border-[var(--app-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-white"
          >
            Back to setup
          </Link>
        }
      />

      {message ? <InlineMessage tone={message.tone}>{message.text}</InlineMessage> : null}

      {inPilot ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(217,164,65,0.35)] bg-[var(--semantic-warning-bg)] p-5 shadow-[var(--app-shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--app-text-strong)]">
              {pilotDaysLeft != null && pilotDaysLeft >= 0
                ? `${pilotDaysLeft} day${pilotDaysLeft === 1 ? "" : "s"} left in your pilot trial`
                : "Your pilot trial has ended"}
            </p>
            <p className="mt-1 text-sm text-[var(--app-text)]">
              Convert now to keep full access without interruption.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleConvertPilot()}
            disabled={converting}
            className="shrink-0 rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {converting ? "Converting..." : "Convert to paid"}
          </button>
        </div>
      ) : null}

      <SectionCard
        eyebrow="Identity"
        title="Edit company details"
        description="These details complete the 'Company profile' setup step."
      >
        {loading ? (
          <InlineMessage>Loading company profile...</InlineMessage>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.key} className={field.full ? "block text-sm md:col-span-2" : "block text-sm"}>
                  <span className="font-semibold text-[var(--app-text-strong)]">{field.label}</span>
                  <input
                    type={field.type ?? "text"}
                    value={form[field.key]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </label>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">Company logo</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                Appears on generated documents and reports. PNG, JPG, WebP, GIF, or SVG under 1.5 MB.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-white">
                  {logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDataUrl} alt="Company logo preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">No logo</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-xl border border-[var(--app-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]">
                    {logoDataUrl ? "Replace logo" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {logoDataUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoDataUrl("");
                        setLogoFileName("");
                      }}
                      className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[#9f1f1c] transition hover:bg-[var(--semantic-danger-bg)]"
                    >
                      Remove
                    </button>
                  ) : null}
                  {logoFileName ? (
                    <span className="text-xs text-[var(--app-muted)]">{logoFileName}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save company profile"}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={saving || loading}
                className="rounded-xl border border-[var(--app-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
