"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Rocket, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  buildAdoptionChecklist,
  type AdoptionChecklistInput,
} from "@/components/dashboard/onboardingChecklist";
import { emptyOnboardingState, type OnboardingState } from "@/lib/onboardingState";

const supabase = getSupabaseBrowserClient();

/**
 * Dismissible "finish setup" banner for the SafePredict home. Renders nothing until data
 * loads, and nothing once onboarding is complete or the owner dismisses it.
 */
export function OnboardingBanner() {
  const [summary, setSummary] = useState<{ completed: number; total: number; next: string | null } | null>(
    null
  );
  const [dismissed, setDismissed] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) return;
          const headers = { Authorization: `Bearer ${token}` };

          // Cheap first check: once dismissed (or auto-dismissed on completion) we never
          // load the heavier adoption endpoints again.
          const onboardingRes = await fetch("/api/onboarding/state", { headers });
          const onboarding =
            ((await onboardingRes.json().catch(() => null)) as OnboardingState | null) ??
            emptyOnboardingState();
          if (cancelled) return;
          if (onboarding.dismissedAt) {
            setDismissed(true);
            return;
          }

          const [meRes, usersRes, documentsRes, workspaceRes] = await Promise.all([
            fetch("/api/auth/me", { headers }),
            fetch("/api/company/users", { headers }),
            fetch("/api/workspace/documents", { headers }),
            fetch("/api/company/workspace/summary", { headers }),
          ]);
          if (cancelled) return;
          const me = (await meRes.json().catch(() => null)) as
            | { user?: { companyProfile?: AdoptionChecklistInput["companyProfile"] } }
            | null;

          // No company linked (internal admin / superadmin viewing the workspace) → no banner.
          if (meRes.ok && !me?.user?.companyProfile) {
            setDismissed(true);
            return;
          }

          const users = (await usersRes.json().catch(() => null)) as
            | { users?: AdoptionChecklistInput["companyUsers"]; invites?: AdoptionChecklistInput["companyInvites"] }
            | null;
          const documents = (await documentsRes.json().catch(() => null)) as
            | { documents?: AdoptionChecklistInput["documents"] }
            | null;
          const workspace = (await workspaceRes.json().catch(() => null)) as
            | { jobsites?: AdoptionChecklistInput["jobsites"] }
            | null;

          const checklist = buildAdoptionChecklist({
            companyProfile: meRes.ok ? me?.user?.companyProfile ?? null : null,
            companyUsers: usersRes.ok ? users?.users ?? [] : [],
            companyInvites: usersRes.ok ? users?.invites ?? [] : [],
            jobsites: workspaceRes.ok ? workspace?.jobsites ?? [] : [],
            documents: documentsRes.ok ? documents?.documents ?? [] : [],
            commandCenterViewed:
              onboarding.completedSteps.includes("command_center") ||
              Boolean(onboarding.lastSeenCommandCenterAt),
          });

          if (cancelled) return;

          // Setup finished → persist a dismiss so future home loads short-circuit after one call.
          if (checklist.totalCount > 0 && checklist.completedCount >= checklist.totalCount) {
            setDismissed(true);
            await fetch("/api/onboarding/state", {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ dismissed: true }),
            }).catch(() => undefined);
            return;
          }

          setSummary({
            completed: checklist.completedCount,
            total: checklist.totalCount,
            next: checklist.nextItem?.label ?? null,
          });
        } catch {
          // Non-blocking: a hidden banner on failure is fine.
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const handleDismiss = useCallback(async () => {
    setHidden(true);
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
      // Already hidden locally; ignore.
    }
  }, []);

  if (hidden || dismissed || !summary) return null;
  if (summary.total > 0 && summary.completed >= summary.total) return null;

  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-[linear-gradient(120deg,#eff6ff_0%,#ffffff_70%)] p-4 shadow-[0_12px_30px_rgba(37,99,235,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600/12 text-blue-700">
          <Rocket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            Finish setting up your workspace — {summary.completed} of {summary.total} steps done
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {summary.next ? `Next: ${summary.next}.` : "You're almost there."}
          </p>
          <div className="mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/safe-predict/get-started"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-500"
        >
          Continue setup
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          aria-label="Dismiss setup banner"
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
