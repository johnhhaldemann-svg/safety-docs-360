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

export function CompanyProfileEditor() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        | { profile?: Partial<ProfileForm>; error?: string }
        | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error || "Could not load company profile." });
        setLoading(false);
        return;
      }
      setForm({ ...EMPTY_FORM, ...(data?.profile ?? {}) });
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
        body: JSON.stringify(form),
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
  }, [form]);

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
