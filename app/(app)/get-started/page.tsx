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
  jobsites: NonNullable<AdoptionChecklistInput["jobsites"]>;
  documents: NonNullable<AdoptionChecklistInput["documents"]>;
  onboardingState: OnboardingState;
};

const emptyAdoptionData = (): AdoptionData => ({
  companyProfile: null,
  companyUsers: [],
  companyInvites: [],
  jobsites: [],
  documents: [],
  onboardingState: emptyOnboardingState(),
});

export default function GetStartedPage() {
  const [data, setData] = useState<AdoptionData>(emptyAdoptionData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const [meRes, usersRes, documentsRes, workspaceRes, onboardingRes] = await Promise.all([
        fetch("/api/auth/me", { headers }),
        fetch("/api/company/users", { headers }),
        fetch("/api/workspace/documents", { headers }),
        fetch("/api/company/workspace/summary", { headers }),
        fetch("/api/onboarding/state", { headers }),
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

      setData({
        companyProfile: meRes.ok ? meJson?.user?.companyProfile ?? null : null,
        companyUsers: usersRes.ok ? usersJson?.users ?? [] : [],
        companyInvites: usersRes.ok ? usersJson?.invites ?? [] : [],
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

  const checklist = useMemo(
    () =>
      buildAdoptionChecklist({
        companyProfile: data.companyProfile,
        companyUsers: data.companyUsers,
        companyInvites: data.companyInvites,
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
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-[var(--app-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh progress"}
            </button>
            <Link
              href="/command-center"
              className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open Command Center
            </Link>
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
                    <Link
                      href={item.href}
                      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        item.complete
                          ? "border border-[var(--app-border)] bg-white/70 text-[var(--app-text-strong)] hover:bg-white"
                          : "bg-[var(--app-accent-primary)] text-white hover:opacity-90"
                      }`}
                    >
                      {item.complete ? "Review" : "Start"}
                    </Link>
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
            actionHref="/command-center"
            actionLabel="Open Command Center"
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
