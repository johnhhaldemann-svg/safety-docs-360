"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  HardHat,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  buildAdoptionChecklist,
  type AdoptionChecklistInput,
} from "@/components/dashboard/onboardingChecklist";
import { emptyOnboardingState, type OnboardingState } from "@/lib/onboardingState";

const supabase = getSupabaseBrowserClient();

type AdoptionData = {
  companyProfile: AdoptionChecklistInput["companyProfile"];
  companyUsers: NonNullable<AdoptionChecklistInput["companyUsers"]>;
  companyInvites: NonNullable<AdoptionChecklistInput["companyInvites"]>;
  trackedEmployees: NonNullable<AdoptionChecklistInput["trackedEmployees"]>;
  jobsites: NonNullable<AdoptionChecklistInput["jobsites"]>;
  documents: NonNullable<AdoptionChecklistInput["documents"]>;
  onboardingState: OnboardingState;
};

const emptyAdoptionData = (): AdoptionData => ({
  companyProfile: null,
  companyUsers: [],
  companyInvites: [],
  trackedEmployees: [],
  jobsites: [],
  documents: [],
  onboardingState: emptyOnboardingState(),
});

type WizardStep = {
  id: "company_profile" | "team_invites" | "first_jobsite" | "first_document" | "command_center";
  icon: React.ElementType;
  title: string;
  description: string;
  what: string[];
  ctaLabel: string;
  ctaHref: string;
  newTab: boolean;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "company_profile",
    icon: Building2,
    title: "Set up your company profile",
    description:
      "Your company name, industry, and contact details power the whole workspace. They appear on safety documents, reports, and help the AI understand your industry context.",
    what: [
      "Legal company name",
      "Industry type (construction, oil & gas, utilities, etc.)",
      "Phone number and address",
    ],
    ctaLabel: "Open Company Profile",
    ctaHref: "/safe-predict/company-profile",
    newTab: true,
  },
  {
    id: "team_invites",
    icon: Users,
    title: "Add your team roster",
    description:
      "Import your employee list so safety managers can assign training, certifications, and site access. Employees on the roster don't need paid login seats — only users who log in daily do.",
    what: [
      "Employee names, roles, and trade info (CSV or Excel)",
      "OR type an email address to invite a teammate directly",
      "You can upload the full roster or start with just a few",
    ],
    ctaLabel: "Open Data Import",
    ctaHref: "/safe-predict/onboarding-import?tab=employees",
    newTab: true,
  },
  {
    id: "first_jobsite",
    icon: MapPin,
    title: "Add your first jobsite",
    description:
      "Every JSA, incident, permit, and risk score is anchored to a jobsite. Add your most active project or location first — you can add more any time.",
    what: [
      "Site name or project number",
      "Site address or location description",
      "Type of work being performed",
    ],
    ctaLabel: "Open Jobsites",
    ctaHref: "/safe-predict/jobsites?new=1",
    newTab: true,
  },
  {
    id: "first_document",
    icon: ClipboardCheck,
    title: "Create your first Job Safety Analysis",
    description:
      "A JSA breaks work into steps, identifies hazards, and documents controls before work begins. Use the AI Fill button on any step — just type the task name and AI suggests the hazard, mitigation, and permit requirements.",
    what: [
      "Job or task name (e.g. \"Trenching\" or \"Overhead welding\")",
      "Select the jobsite this JSA applies to",
      "Add one work step to get started — you can add more as you go",
    ],
    ctaLabel: "Open JSA Builder",
    ctaHref: "/safe-predict/jsa",
    newTab: true,
  },
  {
    id: "command_center",
    icon: LayoutDashboard,
    title: "Your Command Center is ready",
    description:
      "The Command Center is your daily operating hub. It shows risk indicators, open corrective actions, permit status, and team activity — everything you need to start the day. Bookmark it.",
    what: [
      "Daily risk dashboard for all active jobsites",
      "Open actions, permits, and JSAs at a glance",
      "Team activity and upcoming safety events",
    ],
    ctaLabel: "Open Command Center",
    ctaHref: "/safe-predict",
    newTab: false,
  },
];

export function GetStartedWizard() {
  const [data, setData] = useState<AdoptionData>(emptyAdoptionData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [skipping, setSkipping] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (sessionError || !token) {
        setError("Sign in to view your setup checklist.");
        setData(emptyAdoptionData());
        if (!silent) setLoading(false);
        else setRefreshing(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, usersRes, documentsRes, workspaceRes, onboardingRes, trackedRes] =
        await Promise.all([
          fetch("/api/auth/me", { headers }),
          fetch("/api/company/users", { headers }),
          fetch("/api/workspace/documents", { headers }),
          fetch("/api/company/workspace/summary", { headers }),
          fetch("/api/onboarding/state", { headers }),
          fetch("/api/company/tracked-employees", { headers }),
        ]);

      const meJson = (await meRes.json().catch(() => null)) as
        | { user?: { companyProfile?: AdoptionChecklistInput["companyProfile"] } }
        | null;
      const usersJson = (await usersRes.json().catch(() => null)) as
        | {
            users?: AdoptionChecklistInput["companyUsers"];
            invites?: AdoptionChecklistInput["companyInvites"];
          }
        | null;
      const documentsJson = (await documentsRes.json().catch(() => null)) as
        | { documents?: AdoptionChecklistInput["documents"] }
        | null;
      const workspaceJson = (await workspaceRes.json().catch(() => null)) as
        | { jobsites?: AdoptionChecklistInput["jobsites"] }
        | null;
      const onboardingJson = (await onboardingRes.json().catch(
        () => null
      )) as OnboardingState | null;
      const trackedJson = (await trackedRes.json().catch(() => null)) as
        | { employees?: AdoptionChecklistInput["trackedEmployees"] }
        | null;

      setData({
        companyProfile: meRes.ok ? meJson?.user?.companyProfile ?? null : null,
        companyUsers: usersRes.ok ? usersJson?.users ?? [] : [],
        companyInvites: usersRes.ok ? usersJson?.invites ?? [] : [],
        trackedEmployees: trackedRes.ok ? trackedJson?.employees ?? [] : [],
        jobsites: workspaceRes.ok ? workspaceJson?.jobsites ?? [] : [],
        documents: documentsRes.ok ? documentsJson?.documents ?? [] : [],
        onboardingState:
          onboardingRes.ok && onboardingJson ? onboardingJson : emptyOnboardingState(),
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load your setup checklist."
      );
      setData(emptyAdoptionData());
    }

    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleOpenCommandCenter = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/onboarding/state", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markCommandCenterViewed: true }),
        }).catch(() => undefined);
      }
    } catch {
      // Non-blocking.
    }
    window.location.assign("/safe-predict");
  }, []);

  const handleSkip = useCallback(async () => {
    setSkipping(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch("/api/onboarding/state", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        });
      }
    } catch {
      // Non-blocking.
    }
    window.location.assign("/safe-predict");
  }, []);

  const checklist = useMemo(
    () =>
      buildAdoptionChecklist({
        companyProfile: data.companyProfile,
        companyUsers: data.companyUsers,
        companyInvites: data.companyInvites,
        trackedEmployees: data.trackedEmployees,
        jobsites: data.jobsites,
        documents: data.documents,
        commandCenterViewed:
          data.onboardingState.completedSteps.includes("command_center") ||
          Boolean(data.onboardingState.lastSeenCommandCenterAt),
      }),
    [data]
  );

  const completionMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const item of checklist.items) {
      map[item.id] = item.complete;
    }
    return map;
  }, [checklist]);

  const allComplete =
    checklist.completedCount === checklist.totalCount && checklist.totalCount > 0;
  const step = WIZARD_STEPS[currentStep];
  const isComplete = completionMap[step.id] ?? false;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      void handleOpenCommandCenter();
    } else {
      setCurrentStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
    }
  }, [isLastStep, handleOpenCommandCenter]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const StepIcon = step.icon;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-accent-primary-soft)]">
            <HardHat className="h-6 w-6 text-[var(--app-accent-primary)] animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-[var(--app-text)]">Loading your workspace setup…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--app-muted)]">
            Getting Started
          </p>
          <h1 className="text-2xl font-black text-[var(--app-text-strong)]">
            Set up your workspace
          </h1>
          <p className="text-sm text-[var(--app-text)]">
            Step {currentStep + 1} of {WIZARD_STEPS.length}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {WIZARD_STEPS.map((s, i) => {
            const done = completionMap[s.id] ?? false;
            const active = i === currentStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`flex items-center justify-center rounded-full transition-all ${
                  done
                    ? "h-8 w-8 bg-emerald-500 text-white shadow-sm"
                    : active
                    ? "h-8 w-8 bg-[var(--app-accent-primary)] text-white shadow-sm"
                    : "h-8 w-8 border-2 border-[var(--app-border)] bg-white text-[var(--app-muted)] hover:border-[var(--app-accent-primary)]"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main step card */}
        <div className="rounded-3xl border border-[var(--app-border-strong)] bg-white shadow-[var(--app-shadow-medium)] overflow-hidden">

          {/* Card top accent */}
          <div className={`h-1.5 w-full ${isComplete ? "bg-emerald-400" : "bg-[var(--app-accent-primary)]"}`} />

          <div className="p-8 space-y-6">

            {/* Icon + title */}
            <div className="flex items-start gap-5">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                isComplete
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
              }`}>
                <StepIcon className="h-7 w-7" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-[var(--app-text-strong)]">{step.title}</h2>
                  {isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Done
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--app-text)]">{step.description}</p>
              </div>
            </div>

            {/* What you need */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-subtle,#f8fafc)] p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)]">
                What you need
              </p>
              <ul className="space-y-1.5">
                {step.what.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--app-text)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-accent-primary)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Status + CTA */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Step complete — ready to move on
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void load(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-bg-subtle)] disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
                    {refreshing ? "Checking…" : "Check status"}
                  </button>
                )}
              </div>

              {step.id === "command_center" ? (
                <button
                  type="button"
                  onClick={() => void handleOpenCommandCenter()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--app-accent-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  {step.ctaLabel}
                </button>
              ) : (
                <a
                  href={step.ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--app-accent-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {step.ctaLabel}
                </a>
              )}
            </div>

            {!isComplete && step.id !== "command_center" && (
              <p className="text-[11px] text-[var(--app-muted)] leading-5">
                The page opens in a new tab so you can come back here when done.
                Hit <strong>Check status</strong> to update your progress, then click <strong>Next</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>

          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={skipping}
            className="text-xs font-medium text-[var(--app-muted)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {skipping ? "Skipping…" : "Skip setup for now"}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 ${
              isComplete
                ? "bg-emerald-500"
                : "bg-[var(--app-accent-primary)]"
            }`}
          >
            {isLastStep ? (
              <>
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Finish setup
              </>
            ) : (
              <>
                {isComplete ? "Next step" : "Skip this step"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </div>

        {/* All complete banner */}
        {allComplete && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-6 py-5 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" aria-hidden />
            <p className="text-base font-black text-emerald-800">All steps complete!</p>
            <p className="text-sm text-emerald-700">
              Your workspace is ready. Open the Command Center to start your first day.
            </p>
            <button
              type="button"
              onClick={() => void handleOpenCommandCenter()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Open Command Center
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
