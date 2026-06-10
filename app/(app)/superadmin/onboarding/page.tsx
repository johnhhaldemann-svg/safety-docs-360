"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Rocket,
  XCircle,
} from "lucide-react";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import { PLATFORM_FEATURES, getEnterpriseTier } from "@/lib/platformPricing";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-panel)] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-white">{title}</h2>
          {description ? <p className="mt-1 text-[12px] text-slate-500">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Pill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        on ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.04] text-slate-500"
      )}
    >
      {label}
    </span>
  );
}

export default function SuperadminOnboardingPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "warning";
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
    const needsSetup = activeCompanies.filter((company) => deriveSetup(company).completed < 3).length;
    return [
      { label: "Pending Requests", value: signupRequests.length, accent: "text-amber-300", bar: "bg-amber-400" },
      { label: "Active Workspaces", value: activeCompanies.length, accent: "text-cyan-300", bar: "bg-cyan-400" },
      { label: "In Pilot Trial", value: inPilot, accent: "text-violet-300", bar: "bg-violet-400" },
      { label: "Setup Incomplete", value: needsSetup, accent: "text-rose-300", bar: "bg-rose-400" },
    ];
  }, [activeCompanies, signupRequests]);

  const messageClass =
    message?.tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200"
      : message?.tone === "warning"
        ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-200"
        : "border-rose-500/30 bg-rose-500/[0.08] text-rose-200";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <Rocket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Onboarding Control</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Approve new company workspaces in one click and track customer setup progress.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <Link
            href="/admin/companies"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            Full company controls
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {message ? (
        <div className={cx("rounded-xl border px-4 py-3 text-sm", messageClass)}>{message.text}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-panel)] p-4"
          >
            <div className={cx("absolute inset-x-0 top-0 h-0.5", stat.bar)} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {stat.label}
            </p>
            <p className={cx("sa-nums mt-2 text-3xl font-black tracking-tight", stat.accent)}>
              {loading ? <span className="text-slate-600">—</span> : stat.value}
            </p>
          </div>
        ))}
      </div>

      <Panel
        title="Pending Workspace Requests"
        description="One click approves with Tier 2 defaults, all feature modules, and a 30-day pilot trial. Use full controls for custom pricing."
      >
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading workspace requests…</p>
        ) : signupRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--sa-border-strong)] bg-[var(--sa-panel-soft)] px-4 py-10 text-center">
            <Rocket className="mx-auto h-5 w-5 text-slate-600" aria-hidden />
            <p className="mt-2 text-sm font-bold text-slate-200">No workspace requests waiting</p>
            <p className="mt-1 text-xs text-slate-500">
              New company requests appear here when a customer signs up.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {signupRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col gap-4 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-100">{request.company_name}</p>
                    <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {request.primary_contact_name || "No contact"} ·{" "}
                    {request.primary_contact_email || "No email"}
                    {request.industry ? ` · ${request.industry}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Requested {formatRelative(request.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRequestAction(request.id, "approve")}
                    disabled={processingId === request.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/90 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" aria-hidden />
                    Reject
                  </button>
                  <Link
                    href="/admin/companies"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
                  >
                    Custom terms
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Company Setup Progress"
        description="How far each active workspace has gotten: profile details, team roster, and first documents. Pilot trials are flagged."
      >
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading companies…</p>
        ) : activeCompanies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--sa-border-strong)] bg-[var(--sa-panel-soft)] px-4 py-10 text-center">
            <p className="text-sm font-bold text-slate-200">No active workspaces yet</p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {activeCompanies.map((company) => {
              const setup = deriveSetup(company);
              return (
                <div
                  key={company.id}
                  className="flex flex-col gap-4 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-100">{company.name}</p>
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold",
                          setup.completed === 3
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-amber-400/15 text-amber-300"
                        )}
                      >
                        {setup.completed}/3 set up
                      </span>
                      {setup.inPilot ? (
                        <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                          Pilot trial
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {company.totalUsers} user{company.totalUsers === 1 ? "" : "s"} ·{" "}
                      {company.completedDocuments + company.submittedDocuments} document
                      {company.completedDocuments + company.submittedDocuments === 1 ? "" : "s"} ·
                      created {formatRelative(company.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <Pill label="Profile" on={setup.profile} />
                    <Pill label="Team" on={setup.team} />
                    <Pill label="Documents" on={setup.documents} />
                    <Link
                      href={`/admin/companies/${company.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
                    >
                      View
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="Onboarding Tools"
        description="Jump to the deeper controls and the customer-facing setup guide."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              href: "/admin/companies",
              title: "Add a company manually",
              body: "Create a workspace and assign the owner without waiting for a request.",
            },
            {
              href: "/safe-predict/get-started",
              title: "Customer setup guide",
              body: "See the guided wizard and data-upload templates customers use.",
            },
            {
              href: "/company-onboarding",
              title: "Import templates",
              body: "Employees, jobsites, and training-record spreadsheet templates.",
            },
          ].map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-lg border border-[var(--sa-border)] bg-[var(--sa-panel-soft)] p-4 transition hover:border-cyan-400/30"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-100">{tool.title}</p>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-cyan-300"
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{tool.body}</p>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
