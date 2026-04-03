"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  type AgreementConfig,
  type AgreementSectionGroup,
  getDefaultAgreementConfig,
} from "@/lib/legal";
import {
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AgreementAuditSummary = {
  totalUsers: number;
  acceptedCount: number;
  pendingCount: number;
  currentVersionCount: number;
  outdatedCount: number;
};

function cloneConfig(config: AgreementConfig): AgreementConfig {
  return {
    version: config.version,
    termsOfService: {
      title: config.termsOfService.title,
      sections: config.termsOfService.sections.map((section) => ({ ...section })),
    },
    liabilityWaiver: {
      title: config.liabilityWaiver.title,
      sections: config.liabilityWaiver.sections.map((section) => ({ ...section })),
    },
  };
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<AgreementConfig>(getDefaultAgreementConfig());
  const [summary, setSummary] = useState<AgreementAuditSummary>({
    totalUsers: 0,
    acceptedCount: 0,
    pendingCount: 0,
    currentVersionCount: 0,
    outdatedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as an admin.");
    }

    return session.access_token;
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const [configRes, auditRes] = await Promise.all([
        fetch("/api/admin/legal/config", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/legal/agreements", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const configData = (await configRes.json().catch(() => null)) as
        | (AgreementConfig & { error?: string })
        | null;
      const auditData = (await auditRes.json().catch(() => null)) as
        | {
            summary?: Partial<AgreementAuditSummary>;
            error?: string;
          }
        | null;

      if (!configRes.ok) {
        throw new Error(configData?.error || "Failed to load agreement settings.");
      }

      if (!auditRes.ok) {
        throw new Error(auditData?.error || "Failed to load agreement audit summary.");
      }

      if (configData) {
        setConfig(cloneConfig(configData));
      }

      setSummary({
        totalUsers: Number(auditData?.summary?.totalUsers ?? 0),
        acceptedCount: Number(auditData?.summary?.acceptedCount ?? 0),
        pendingCount: Number(auditData?.summary?.pendingCount ?? 0),
        currentVersionCount: Number(auditData?.summary?.currentVersionCount ?? 0),
        outdatedCount: Number(auditData?.summary?.outdatedCount ?? 0),
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load legal settings."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateGroupTitle(group: keyof Pick<AgreementConfig, "termsOfService" | "liabilityWaiver">, value: string) {
    setConfig((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        title: value,
      },
    }));
  }

  function updateSection(
    group: keyof Pick<AgreementConfig, "termsOfService" | "liabilityWaiver">,
    index: number,
    field: keyof AgreementSectionGroup["sections"][number],
    value: string
  ) {
    setConfig((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        sections: prev[group].sections.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, [field]: value } : section
        ),
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/legal/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const data = (await res.json().catch(() => null)) as
        | (AgreementConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save agreement settings.");
      }

      if (data) {
        setConfig(cloneConfig(data));
      }

      setMessage(
        "Agreement settings saved. If you changed the version, users with older accepted versions will be prompted to re-accept on their next session sync."
      );
      await loadSettings();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save agreement settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Administration"
        title="Legal Agreement Settings"
        description="Manage the live agreement version and legal text used by signup, first-login acceptance, submit controls, and document downloads."
        actions={
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Agreement Settings"}
            </button>
            <button
              type="button"
              onClick={() => setConfig(cloneConfig(getDefaultAgreementConfig()))}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reset to Defaults
            </button>
            <Link
              href="/admin/agreements"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Open Agreement Audit
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={String(summary.totalUsers)} note="Users included in agreement tracking" />
        <StatCard title="Current" value={String(summary.currentVersionCount)} note={`Accepted on ${config.version}`} />
        <StatCard title="Outdated" value={String(summary.outdatedCount)} note="Will be asked to re-accept" />
        <StatCard title="Pending" value={String(summary.pendingCount)} note="No acceptance on file yet" />
      </section>

      {message ? <InlineMessage>{message}</InlineMessage> : null}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <SectionCard
            title="Version Control"
            description="Bump the version whenever the legal text changes and users should be required to re-accept."
          >
            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Active Agreement Version
              </label>
              <input
                type="text"
                value={config.version}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    version: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
              Saving a new version immediately makes that version the required agreement. Users with older accepted versions will be marked outdated and prompted to accept again.
            </div>
          </SectionCard>

          <SectionCard
            title="Rollout Preview"
            description="Current impact based on today&apos;s acceptance records."
          >
            <div className="mt-6 space-y-4">
              <StatusRow
                label="Users already current"
                value={String(summary.currentVersionCount)}
                tone="green"
              />
              <StatusRow
                label="Users needing re-acceptance"
                value={String(summary.outdatedCount)}
                tone="amber"
              />
              <StatusRow
                label="Users with no acceptance yet"
                value={String(summary.pendingCount)}
                tone="red"
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <AgreementGroupEditor
            title="Terms of Service"
            value={config.termsOfService}
            onTitleChange={(value) => updateGroupTitle("termsOfService", value)}
            onSectionChange={(index, field, value) =>
              updateSection("termsOfService", index, field, value)
            }
          />

          <AgreementGroupEditor
            title="Liability Waiver"
            value={config.liabilityWaiver}
            onTitleChange={(value) => updateGroupTitle("liabilityWaiver", value)}
            onSectionChange={(index, field, value) =>
              updateSection("liabilityWaiver", index, field, value)
            }
          />
        </div>
      </section>
    </div>
  );
}

function AgreementGroupEditor({
  title,
  value,
  onTitleChange,
  onSectionChange,
}: {
  title: string;
  value: AgreementSectionGroup;
  onTitleChange: (value: string) => void;
  onSectionChange: (index: number, field: "heading" | "body", value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Edit the live text shown in the agreement gate and legal pages.
      </p>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-semibold text-slate-300">
          Section Group Title
        </label>
        <input
          type="text"
          value={value.title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
        />
      </div>

      <div className="mt-6 space-y-6">
        {value.sections.map((section, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Heading {index + 1}
            </label>
            <input
              type="text"
              value={section.heading}
              onChange={(event) => onSectionChange(index, "heading", event.target.value)}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
            />

            <label className="mb-2 mt-4 block text-sm font-semibold text-slate-300">
              Body {index + 1}
            </label>
            <textarea
              value={section.body}
              onChange={(event) => onSectionChange(index, "body", event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-200";

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-4">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}
