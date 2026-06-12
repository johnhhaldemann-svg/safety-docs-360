"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
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

/**
 * Company users live in the native /safe-predict workspace, so each step links straight to the
 * real destination there. The shared checklist's legacy hrefs (e.g. /company-onboarding) are
 * surfaces the app shell does not auto-remap, which is why linking them raw sent users to the
 * wrong page. Keyed by checklist item id.
 */
const STEP_DESTINATION: Record<string, string> = {
  company_profile: "/safe-predict/company-profile",
  team_invites: "/safe-predict/onboarding-import?tab=employees",
  first_jobsite: "/safe-predict/jobsites?new=1",
  first_document: "/safe-predict/jsa",
  command_center: "/safe-predict",
};

function stepHref(id: string, fallback: string) {
  return STEP_DESTINATION[id] ?? fallback;
}

const COMMAND_CENTER_HREF = "/safe-predict";

const UPLOAD_CARDS = [
  {
    type: "employees" as const,
    title: "Employees / Team roster",
    description:
      "Upload your workforce list. Tracked employees let safety managers assign training, certifications, and site access without using paid seats.",
    href: "/safe-predict/onboarding-import?tab=employees",
  },
  {
    type: "jobsites" as const,
    title: "Jobsites / Projects",
    description:
      "Upload your active sites. Jobsites anchor JSAs, permits, incidents, corrective actions, and predictive risk scores.",
    href: "/safe-predict/onboarding-import?tab=jobsites",
  },
  {
    type: "training_records" as const,
    title: "Training Matrix / Records",
    description:
      "Upload who completed which training and when it expires. Powers the Training Tracker, compliance reports, and expiry alerts.",
    href: "/safe-predict/onboarding-import?tab=training_records",
  },
];

const PROVIDED_BY_COMPANY = [
  "Employee roster, jobsite list, and training records (CSV or Excel) — upload via the Data Import page.",
  "Company profile details: legal name, industry, phone, address.",
  "Company logo (optional, for branded documents and reports).",
  "Names/emails of any teammates who need a licensed login seat.",
];

const SET_UP_BY_PLATFORM = [
  "Workspace activation and owner access (done at approval).",
  "Plan tier, feature modules, and your 30-day pilot trial.",
  "Predictive risk engine, dashboards, and Command Center.",
  "Document templates, marketplace, and AI safety rules.",
];

export function GetStartedWizard() {
  const [data, setData] = useState<AdoptionData>(emptyAdoptionData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skipping, setSkipping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, usersRes, documentsRes, workspaceRes, onboardingRes, trackedRes] = await Promise.all([
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
      const onboardingJson = (await onboardingRes.json().catch(() => null)) as OnboardingState | null;
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

    setLoading(false);
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
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
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
      // Non-blocking: fall through to the workspace home regardless.
    }
    // Hard navigation so the app shell re-reads onboarding state and clears the first-run gate.
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

  const progressPct =
    checklist.totalCount > 0
      ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
      : 0;
  const allComplete = checklist.completedCount === checklist.totalCount && checklist.totalCount > 0;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Getting Started"
        title="Set up your workspace"
        description="Follow these five steps to get your company live. Each step opens the right page — finish them in any order and your progress saves automatically."
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSkip()}
              disabled={skipping}
              className="rounded-xl border border-[var(--app-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--app-muted)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {skipping ? "Skipping..." : "Skip for now"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-[var(--app-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh progress"}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenCommandCenter()}
              className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open Command Center
            </button>
          </div>
        }
      />

      {error ? (
        <InlineMessage tone="error" onRetry={() => void load()}>
          {error}
        </InlineMessage>
      ) : null}

      <SectionCard
        eyebrow="Progress"
        title={allComplete ? "You're all set" : `${checklist.completedCount} of ${checklist.totalCount} steps complete`}
        description={
          allComplete
            ? "Every setup milestone is done. Your team can now run daily safety operations from the Command Center."
            : checklist.nextItem
              ? `Next up: ${checklist.nextItem.label}.`
              : "Loading your progress..."
        }
        aside={
          <StatusBadge
            label={allComplete ? "Complete" : `${progressPct}%`}
            tone={allComplete ? "success" : "warning"}
          />
        }
      >
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--semantic-neutral-bg)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,_var(--app-accent-primary)_0%,_var(--semantic-success)_100%)] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {loading ? (
          <InlineMessage>Loading your setup checklist...</InlineMessage>
        ) : (
          <ol className="grid gap-3">
            {checklist.items.map((item, index) => {
              const isNext = !item.complete && checklist.nextItem?.id === item.id;
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 shadow-[var(--app-shadow-soft)] sm:flex-row sm:items-center sm:justify-between ${
                    item.complete
                      ? "border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)]"
                      : isNext
                        ? "border-[var(--app-accent-border-28)] bg-white"
                        : "border-[var(--app-border)] bg-white/90"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        item.complete
                          ? "bg-[var(--semantic-success)] text-white"
                          : "bg-[var(--app-accent-primary)] text-white"
                      }`}
                    >
                      {item.complete ? "✓" : index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[var(--app-text-strong)]">{item.label}</p>
                        <StatusBadge
                          label={item.complete ? "Done" : isNext ? "Do this next" : "To do"}
                          tone={item.complete ? "success" : isNext ? "warning" : "neutral"}
                        />
                      </div>
                      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--app-text)]">{item.note}</p>
                    </div>
                  </div>
                  <div className="sm:shrink-0">
                    {item.id === "command_center" ? (
                      <button
                        type="button"
                        onClick={() => void handleOpenCommandCenter()}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                          item.complete
                            ? "border border-[var(--app-border)] bg-white/70 text-[var(--app-text-strong)] hover:bg-white"
                            : "bg-[var(--app-accent-primary)] text-white hover:opacity-90"
                        }`}
                      >
                        {item.complete ? "Review" : "Start"}
                      </button>
                    ) : (
                      <Link
                        href={stepHref(item.id, item.href)}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                          item.complete
                            ? "border border-[var(--app-border)] bg-white/70 text-[var(--app-text-strong)] hover:bg-white"
                            : "bg-[var(--app-accent-primary)] text-white hover:opacity-90"
                        }`}
                      >
                        {item.complete ? "Review" : "Start"}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {allComplete && !loading ? (
          <EmptyState
            eyebrow="Launch complete"
            title="Your workspace is ready"
            description="Head to the Command Center to monitor risk, open work, and recommended actions every day."
            actionHref={COMMAND_CENTER_HREF}
            actionLabel="Open Command Center"
          />
        ) : null}
      </SectionCard>

      <SectionCard
        eyebrow="Who does what"
        title="What you provide vs. what we set up"
        description="You bring your people and project data. We handle the platform, the risk engine, and the configuration."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--app-accent-border-28)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
            <div className="flex items-center gap-2">
              <StatusBadge label="You provide" tone="warning" />
            </div>
            <ul className="mt-3 space-y-2">
              {PROVIDED_BY_COMPANY.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--app-text)]">
                  <span className="mt-1 text-[var(--app-accent-primary)]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)] p-5 shadow-[var(--app-shadow-soft)]">
            <div className="flex items-center gap-2">
              <StatusBadge label="We set up" tone="success" />
            </div>
            <ul className="mt-3 space-y-2">
              {SET_UP_BY_PLATFORM.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--app-text)]">
                  <span className="mt-1 text-[var(--semantic-success)]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Upload your company data"
        title="Where to upload your files"
        description="Head to the Data Import page to upload your employee roster, jobsite list, and training records. CSV and Excel both work — no specific column order required."
        actions={
          <Link
            href="/safe-predict/onboarding-import"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Go to Data Import
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {UPLOAD_CARDS.map((card) => (
            <Link
              key={card.type}
              href={card.href}
              className="flex flex-col rounded-2xl border border-[var(--app-border)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)] transition hover:border-[var(--app-accent-border-28)] hover:shadow-md"
            >
              <p className="text-sm font-bold text-[var(--app-text-strong)]">{card.title}</p>
              <p className="mt-2 flex-1 text-sm leading-6 text-[var(--app-text)]">{card.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-accent-primary)]">
                Upload now →
              </span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
