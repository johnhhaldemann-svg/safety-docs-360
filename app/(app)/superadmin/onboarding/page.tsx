"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, Rocket, XCircle } from "lucide-react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appButtonQuietClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import { PLATFORM_FEATURES, getEnterpriseTier } from "@/lib/platformPricing";

type CompanySummary = {
  id: string;
  name: string;
  teamKey: string;
  industry: string;
  primaryContactName: string;
  primaryContactEmail: string;
  status: string;
  createdAt?: string | null;
  pilotTrialEndsAt?: string | null;
  pilotConvertedAt?: string | null;
  totalUsers: number;
  pendingInvites: number;
  completedDocuments: number;
  submittedDocuments: number;
};

type SignupRequest = {
  id: string;
  company_name: string;
  industry: string;
  primary_contact_name: string;
  primary_contact_email: string;
  phone: string;
  status: string;
  created_at?: string | null;
};

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.max(1, Math.round(diffDays / 30));
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

type SetupState = {
  profile: boolean;
  team: boolean;
  documents: boolean;
  completed: number;
  inPilot: boolean;
};

function deriveSetup(company: CompanySummary): SetupState {
  const profile = Boolean(company.industry && company.primaryContactEmail);
  const team = company.totalUsers > 0 || company.pendingInvites > 0;
  const documents = company.completedDocuments + company.submittedDocuments > 0;
  return {
    profile,
    team,
    documents,
    completed: [profile, team, documents].filter(Boolean).length,
    inPilot: Boolean(company.pilotTrialEndsAt) && !company.pilotConvertedAt,
  };
}

export default function SuperadminOnboardingPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "warning" | "neutral";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Sign in as a superadmin to manage onboarding.");
      const res = await fetch("/api/admin/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { companies?: CompanySummary[]; signupRequests?: SignupRequest[]; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error || "Could not load onboarding data.");
      setCompanies(data?.companies ?? []);
      setSignupRequests(data?.signupRequests ?? []);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load onboarding data.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleRequestAction = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setProcessingId(requestId);
      setMessage(null);
      try {
        const token = await getSupabaseAccessToken();
        if (!token) throw new Error("Sign in as a superadmin to manage onboarding.");

        const tier = getEnterpriseTier("professional_network");
        const body =
          action === "approve"
            ? {
                requestId,
                action,
                planName: "Enterprise",
                pilotTrial: true,
                planTierKey: tier.key,
                annualPlatformPriceCents: tier.annualPriceCents,
                includedJobsiteLimit: tier.includedJobsites,
                includedUserLimit: tier.includedUsers,
                onboardingFeeCents: null,
                enabledFeatureKeys: PLATFORM_FEATURES.map((feature) => feature.key),
                selectedAddons: [],
                commercialNotes: null,
              }
            : { requestId, action };

        const res = await fetch("/api/admin/companies", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as
          | { error?: string; message?: string; warning?: string | null }
          | null;
        if (!res.ok) throw new Error(data?.error || "Failed to update the request.");

        setMessage({
          tone: data?.warning ? "warning" : "success",
          text:
            data?.warning ||
            data?.message ||
            (action === "approve"
              ? "Workspace approved with default terms and a 30-day pilot trial."
              : "Workspace request rejected."),
        });
        await load();
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to update the request.",
        });
      } finally {
        setProcessingId("");
      }
    },
    [load]
  );

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.status.trim().toLowerCase() !== "archived"),
    [companies]
  );

  const stats = useMemo(() => {
    const inPilot = activeCompanies.filter((company) => deriveSetup(company).inPilot).length;
    const needsSetup = activeCompanies.filter(
      (company) => deriveSetup(company).completed < 3
    ).length;
    return [
      { label: "Pending Requests", value: signupRequests.length },
      { label: "Active Workspaces", value: activeCompanies.length },
      { label: "In Pilot Trial", value: inPilot },
      { label: "Setup Incomplete", value: needsSetup },
    ];
  }, [activeCompanies, signupRequests]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Superadmin"
        title="Onboarding Control"
        description="Approve new company workspace requests with one click and track how far each customer has gotten through setup."
        actions={
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void load()} className={appButtonSecondaryClassName}>
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
            <Link href="/admin/companies" className={appButtonQuietClassName}>
              Full company controls
            </Link>
          </div>
        }
      />

      {message ? <InlineMessage tone={message.tone}>{message.text}</InlineMessage> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">
              {loading ? "-" : stat.value}
            </p>
          </div>
        ))}
      </div>

      <SectionCard
        eyebrow="Approvals"
        title="Pending Workspace Requests"
        description="One click approves with Tier 2 defaults, all feature modules, and a 30-day pilot trial. Use full controls for custom pricing."
      >
        {loading ? (
          <InlineMessage>Loading workspace requests...</InlineMessage>
        ) : signupRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-10 text-center">
            <Rocket className="mx-auto h-5 w-5 text-[var(--app-muted)]" aria-hidden />
            <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
              No workspace requests waiting
            </p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              New company requests appear here when a customer signs up.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {signupRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col gap-4 rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">
                      {request.company_name}
                    </p>
                    <StatusBadge label="Pending" tone="warning" />
                  </div>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">
                    {request.primary_contact_name || "No contact"} ·{" "}
                    {request.primary_contact_email || "No email"}
                    {request.industry ? ` · ${request.industry}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Requested {formatRelative(request.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRequestAction(request.id, "approve")}
                    disabled={processingId === request.id}
                    className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    )}
                    Quick Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRequestAction(request.id, "reject")}
                    disabled={processingId === request.id}
                    className={`${appButtonQuietClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <XCircle className="h-4 w-4" aria-hidden />
                    Reject
                  </button>
                  <Link href="/admin/companies" className={appButtonSecondaryClassName}>
                    Custom terms
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Adoption"
        title="Company Setup Progress"
        description="How far each active workspace has gotten: profile details, team roster, and first documents. Pilot trials are flagged."
      >
        {loading ? (
          <InlineMessage>Loading companies...</InlineMessage>
        ) : activeCompanies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-10 text-center">
            <p className="text-sm font-bold text-[var(--app-text-strong)]">
              No active workspaces yet
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeCompanies.map((company) => {
              const setup = deriveSetup(company);
              return (
                <div
                  key={company.id}
                  className="flex flex-col gap-4 rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[var(--app-text-strong)]">
                        {company.name}
                      </p>
                      <StatusBadge
                        label={`${setup.completed}/3 set up`}
                        tone={setup.completed === 3 ? "success" : "warning"}
                      />
                      {setup.inPilot ? <StatusBadge label="Pilot trial" tone="info" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">
                      {company.totalUsers} user{company.totalUsers === 1 ? "" : "s"} ·{" "}
                      {company.completedDocuments + company.submittedDocuments} document
                      {company.completedDocuments + company.submittedDocuments === 1 ? "" : "s"} ·
                      created {formatRelative(company.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <StatusBadge label="Profile" tone={setup.profile ? "success" : "neutral"} />
                    <StatusBadge label="Team" tone={setup.team ? "success" : "neutral"} />
                    <StatusBadge label="Documents" tone={setup.documents ? "success" : "neutral"} />
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className={appButtonSecondaryClassName}
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Shortcuts"
        title="Onboarding Tools"
        description="Jump to the deeper controls and the customer-facing setup guide."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/companies"
            className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm transition hover:border-[var(--app-accent-border-28)]"
          >
            <p className="text-sm font-bold text-[var(--app-text-strong)]">Add a company manually</p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Create a workspace and assign the owner without waiting for a request.
            </p>
          </Link>
          <Link
            href="/get-started"
            className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm transition hover:border-[var(--app-accent-border-28)]"
          >
            <p className="text-sm font-bold text-[var(--app-text-strong)]">Customer setup guide</p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              See the guided wizard and data-upload templates customers use.
            </p>
          </Link>
          <Link
            href="/company-onboarding"
            className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm transition hover:border-[var(--app-accent-border-28)]"
          >
            <p className="text-sm font-bold text-[var(--app-text-strong)]">Import templates</p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Employees, jobsites, and training-record spreadsheet templates.
            </p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
