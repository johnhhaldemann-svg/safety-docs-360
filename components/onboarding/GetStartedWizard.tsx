"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileText,
  HardHat,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
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
  id:
    | "company_profile"
    | "team_invites"
    | "first_jobsite"
    | "emergency_action_plan"
    | "first_document"
    | "first_permit"
    | "first_toolbox_talk"
    | "command_center";
  icon: React.ElementType;
  title: string;
  description: string;
  what: string[];
  tip: string;
  unlocks: string[];
  timeEstimate: string;
  ctaLabel: string;
  ctaHref: string;
  newTab: boolean;
  /** true = completion auto-detected from workspace data; false = guided tour step, no check needed */
  tracked: boolean;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "company_profile",
    icon: Building2,
    title: "Set up your company profile",
    tracked: true,
    description:
      "Your company name, industry, and contact details power every corner of the workspace — safety documents, AI suggestions, branded reports, and regulatory compliance logs all pull from this record.",
    what: [
      "Legal company name and primary business address",
      "Industry type — pick the most specific option (e.g. 'Electrical Contractor' not just 'Construction')",
      "Office phone number and primary safety contact email",
      "Company logo (appears on all PDF exports and worker-facing documents)",
      "Emergency contact name and direct phone number",
    ],
    tip: "The industry you pick here trains the AI hazard engine. 'Electrical Contractor' will suggest arc flash controls and LOTO procedures, while 'General Construction' gives broader suggestions. You can change it at any time.",
    unlocks: ["AI hazard suggestions tuned to your trade", "Branded PDFs & reports with your logo", "Industry-specific compliance references", "Emergency contact auto-fills on every permit"],
    timeEstimate: "~3 min",
    ctaLabel: "Open Company Profile",
    ctaHref: "/safe-predict/company-profile",
    newTab: true,
  },
  {
    id: "team_invites",
    icon: Users,
    title: "Add your team roster",
    tracked: true,
    description:
      "There are two types of people in Safety360: logged-in users (safety managers, supervisors) who get a workspace seat, and tracked employees (your full crew) who appear on rosters, training records, and permits but don't need a login.",
    what: [
      "Invite safety managers and supervisors by email — they get full workspace access",
      "Assign roles: Admin (can edit all data), Member (day-to-day use), Viewer (read-only for executives)",
      "Bulk-import your full crew from a CSV/Excel file (name, trade, hire date, certifications)",
      "Add subcontractors separately under the Contractors section once your own crew is in",
    ],
    tip: "Start with 2-3 safety managers first — they need daily access. Your full crew roster (50, 200, 500 workers) can be imported later without affecting your seat count. Workers only need a seat if they'll log in themselves.",
    unlocks: ["Assign training & certifications to any worker", "Track site access and induction status", "Named workers appear on JSA sign-off sheets", "Permit approver drop-down pulls from this list"],
    timeEstimate: "~5 min",
    ctaLabel: "Open Team Setup",
    ctaHref: "/safe-predict/onboarding-import?tab=employees",
    newTab: true,
  },
  {
    id: "first_jobsite",
    icon: MapPin,
    title: "Add your first jobsite",
    tracked: true,
    description:
      "Jobsites are the anchor point for everything operational — every JSA, permit, incident, inspection, and risk score is tied to a site. Add your most active location first; you can add the rest of your portfolio any time.",
    what: [
      "Site name or project number (e.g. 'Bayview Tower — Phase 2')",
      "Full site address — used for weather-based risk scoring and permit location auto-fill",
      "Primary work scope (excavation, structural steel, electrical, etc.)",
      "Designated site safety officer — their name appears on permits and inspection reports",
      "Expected project start and end dates (used for risk forecasting timeline)",
    ],
    tip: "Even a rough address works to start. The system pulls daily weather data by location to flag heat stress, lightning, high-wind, and freeze days as risk factors on the dashboard. Refine the address later if needed.",
    unlocks: ["Site-specific risk score on the dashboard", "Weather-aware daily risk alerts", "Permits and JSAs anchored to a named location", "Site-level safety reports for management review"],
    timeEstimate: "~2 min",
    ctaLabel: "Add First Jobsite",
    ctaHref: "/safe-predict/jobsites?new=1",
    newTab: true,
  },
  {
    id: "emergency_action_plan",
    icon: ShieldAlert,
    title: "Build your Emergency Action Plan",
    tracked: false,
    description:
      "OSHA 29 CFR 1910.38 requires every employer to have a written Emergency Action Plan that is accessible to all employees. In Safety360 it lives on the site record — every worker can pull it up on their phone at any time, even offline.",
    what: [
      "Emergency coordinator: name, title, and direct mobile number",
      "Primary and secondary evacuation routes for the site",
      "Assembly area / muster point — exact location workers go after evacuation",
      "Emergency services contacts: local fire, EMS, nearest trauma hospital, poison control",
      "Procedures for employees with mobility limitations or special needs (if applicable)",
      "Utility shutoff locations: gas, electric, water main valves",
    ],
    tip: "Info entered here auto-populates the Emergency Response section on hot work, confined space, and excavation permit templates — you won't re-enter it on every permit. It also appears on the printed JSA cover page.",
    unlocks: ["OSHA 29 CFR 1910.38 compliance documentation", "Emergency info pre-fills on all permit types", "Workers access the EAP on their phone anytime", "EAP included in management review reports"],
    timeEstimate: "~5 min",
    ctaLabel: "Open Emergency Action Plan",
    ctaHref: "/safe-predict/emergency-action-plan",
    newTab: true,
  },
  {
    id: "first_document",
    icon: ClipboardCheck,
    title: "Create your first Job Safety Analysis",
    tracked: true,
    description:
      "A JSA breaks any job into individual work steps, identifies the hazard at each step, documents the control measure, and specifies who is responsible. It's the core field document for pre-task safety planning — and the AI can write a first draft from just a task name.",
    what: [
      "Job or task name (e.g. 'Overhead welding' or 'Excavation 6ft+')",
      "Select the jobsite this JSA covers",
      "Add at least one work step — click AI Fill, type the step description, and let AI suggest the hazard, mitigation, and required controls",
      "Assign the responsible person or crew for this task",
      "Set a review date — the system will remind you when it expires",
    ],
    tip: "Click 'AI Fill' on any work step and type a plain-English task description. AI will write the hazard, severity rating, mitigation control, and required PPE automatically. Edit to match your specific site conditions, then save. A 10-step JSA takes about 3 minutes with AI Fill.",
    unlocks: ["PDF export with your company logo and branding", "Worker sign-off and digital acknowledgment tracking", "JSA risk score factored into site dashboard", "Permit system links back to the relevant JSA"],
    timeEstimate: "~5 min",
    ctaLabel: "Open JSA Builder",
    ctaHref: "/safe-predict/jsa",
    newTab: true,
  },
  {
    id: "first_permit",
    icon: FileCheck2,
    title: "Set up your first work permit",
    tracked: false,
    description:
      "Permits are required by OSHA for high-risk work — hot work, confined space entry, energized electrical, and excavation over 5 ft. The permit system gates work until an authorized person reviews and signs off, creating a complete authorization trail.",
    what: [
      "Permit type: hot work, confined space, electrical isolation (LOTO), excavation, or working at heights",
      "Work location — links to the jobsite you already created",
      "Authorized approver: the person who signs off before work begins (usually the safety officer)",
      "Work start time and expected end time",
      "Hazard controls in place — the system pulls suggested controls from your matching JSA",
    ],
    tip: "Start with the permit type your site uses most. Hot work is the most common in construction and manufacturing. Once you create one, it becomes a reusable template for that work type — future permits take under 2 minutes to issue.",
    unlocks: ["OSHA permit-required confined space & hot work compliance", "Permit linked directly to your JSA hazard controls", "Digital sign-off replaces paper forms", "Permit history searchable for any audit or inspection"],
    timeEstimate: "~3 min",
    ctaLabel: "Open Permits",
    ctaHref: "/safe-predict/permits",
    newTab: true,
  },
  {
    id: "first_toolbox_talk",
    icon: BookOpen,
    title: "Run your first Toolbox Talk",
    tracked: false,
    description:
      "Toolbox Talks are short 5-10 minute pre-shift safety meetings. Safety360 has a library of 50+ pre-written topics. Pick one, present it to your crew, and the system generates a digital attendance sheet — workers sign on their phone or you print it. Every talk is timestamped and stored.",
    what: [
      "Pick a topic from the library: fall protection, PPE, heat stress, electrical safety, trenching, crane & rigging, and more",
      "Select the date and add attending team members from your roster",
      "Present the talk at your next pre-shift meeting (5-10 min is all you need)",
      "Workers sign the attendance sheet digitally on their phone — or print and scan it",
      "The completed record is stored automatically and searchable by date, topic, or attendee",
    ],
    tip: "OSHA inspectors frequently ask for safety meeting records during site visits. Every toolbox talk in Safety360 is timestamped, signed, and searchable — no more chasing paper sign-in sheets. Run one today even if it's just with your supervisor.",
    unlocks: ["OSHA-ready timestamped attendance records", "50+ pre-written topic library with new topics added monthly", "AI-suggested topics based on your site's current hazard profile", "Monthly safety meeting history in management review reports"],
    timeEstimate: "~5 min",
    ctaLabel: "Open Toolbox Talks",
    ctaHref: "/safe-predict/toolbox-talks",
    newTab: true,
  },
  {
    id: "command_center",
    icon: LayoutDashboard,
    title: "Your Command Center is ready",
    tracked: true,
    description:
      "The Command Center is your daily operating hub. It shows live risk indicators for every active jobsite, open corrective actions, permit status, upcoming safety events, and team activity — everything you need to run the day's safety operations at a glance.",
    what: [
      "Daily risk dashboard: site risk score, weather flags, and trending indicators",
      "Open actions and overdue items — with one-click assignment and status updates",
      "Active permits and JSAs awaiting sign-off",
      "Team activity feed: who signed what, recent incidents, and training completions",
      "GUS Smart Safety Bot (bottom-right): ask it any safety question, look up a regulation, or draft a corrective action",
    ],
    tip: "Bookmark the Command Center and make it your browser homepage for work. The GUS bot in the bottom-right corner can answer OSHA questions, explain regulations, and help you write corrective actions — just type your question in plain English.",
    unlocks: ["Live risk overview across all your jobsites", "One-click access to every open action and permit", "AI-powered daily safety recommendations", "Team activity and compliance status at a glance"],
    timeEstimate: "< 1 min",
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
  const isComplete = step.tracked && (completionMap[step.id] ?? false);
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
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {WIZARD_STEPS.map((s, i) => {
            const done = s.tracked && (completionMap[s.id] ?? false);
            const active = i === currentStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                title={s.title}
                className={`flex items-center justify-center rounded-full transition-all ${
                  done
                    ? "h-8 w-8 bg-emerald-500 text-white shadow-sm"
                    : active
                    ? "h-8 w-8 bg-[var(--app-accent-primary)] text-white shadow-sm"
                    : s.tracked
                    ? "h-8 w-8 border-2 border-[var(--app-border)] bg-white text-[var(--app-muted)] hover:border-[var(--app-accent-primary)]"
                    : "h-8 w-8 border-2 border-dashed border-[var(--app-border)] bg-white text-[var(--app-muted)] hover:border-[var(--app-accent-primary)]"
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                    {step.timeEstimate}
                  </span>
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

            {/* Pro tip */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" aria-hidden />
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Pro tip</p>
                <p className="text-sm leading-6 text-amber-900">{step.tip}</p>
              </div>
            </div>

            {/* Unlocks */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--app-muted)] flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                After this step you unlock
              </p>
              <div className="flex flex-wrap gap-2">
                {step.unlocks.map((u) => (
                  <span
                    key={u}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-accent-primary-soft,#dbeafe)] bg-[var(--app-accent-primary-soft,#eff6ff)] px-3 py-1 text-xs font-semibold text-[var(--app-accent-primary)]"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {u}
                  </span>
                ))}
              </div>
            </div>

            {/* Status + CTA */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {step.tracked ? (
                  isComplete ? (
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
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--app-accent-primary-soft,#eff6ff)] border border-[var(--app-accent-primary-soft,#dbeafe)] px-3 py-2 text-sm font-semibold text-[var(--app-accent-primary)]">
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                    Guided setup — explore at your own pace
                  </span>
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

            {step.tracked && !isComplete && step.id !== "command_center" && (
              <p className="text-[11px] text-[var(--app-muted)] leading-5">
                The page opens in a new tab so you can come back here when done.
                Hit <strong>Check status</strong> to update your progress, then click <strong>Next</strong>.
              </p>
            )}
            {!step.tracked && (
              <p className="text-[11px] text-[var(--app-muted)] leading-5">
                This page opens in a new tab. Take a few minutes to explore and set it up, then come back and click <strong>Next step</strong> to continue.
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
                {isComplete ? "Next step" : !step.tracked ? "Next step" : "Skip this step"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </div>

        {/* All complete banner */}
        {allComplete && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-6 py-6 space-y-5">
            <div className="text-center space-y-2">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" aria-hidden />
              <p className="text-lg font-black text-emerald-800">Your workspace is ready!</p>
              <p className="text-sm text-emerald-700">
                All 5 steps complete. Here&apos;s what to do on your first day:
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a
                href="/safe-predict/jsa"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
              >
                <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                Create a second JSA
              </a>
              <a
                href="/safe-predict/onboarding-import?tab=employees"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
              >
                <Users className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                Invite your site supervisor
              </a>
              <a
                href="/safe-predict/documents"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
              >
                <FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                Browse all document types
              </a>
            </div>
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => void handleOpenCommandCenter()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                Open Command Center
              </button>
            </div>
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
