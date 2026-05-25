"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SegmentedRouteChips } from "@/components/AppTabBar";
import {
  JOBSITE_NAV_PHASES,
  getJobsiteWorkspacePhaseId,
  jobsitePhaseChildLinks,
} from "@/lib/jobsiteWorkspaceNav";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const supabase = getSupabaseBrowserClient();

export function JobsiteTopTabs({
  jobsiteId,
}: {
  jobsiteId: string;
}) {
  const pathname = usePathname();
  const activePhaseId = getJobsiteWorkspacePhaseId(pathname) ?? "overview";
  const [jobsiteLabel, setJobsiteLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadJobsiteLabel() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/company/jobsites", {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const payload = (await response.json().catch(() => null)) as
        | { jobsites?: Array<{ id: string; name?: string; jobsite_number?: string | null; project_number?: string | null }> }
        | null;
      const jobsite = payload?.jobsites?.find((row) => row.id === jobsiteId);
      if (!cancelled && jobsite) {
        const number = jobsite.jobsite_number || jobsite.project_number || jobsiteId;
        setJobsiteLabel(`${jobsite.name ?? "Jobsite"} · ${number}`);
      }
    }
    void loadJobsiteLabel();
    return () => {
      cancelled = true;
    };
  }, [jobsiteId]);

  return (
    <div
      className={cx(
        "rounded-xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_#f7fbff_0%,_#edf4ff_55%,_#e7f0fb_100%)] p-3 shadow-[var(--app-shadow-soft)]",
        "sticky top-0 z-20 backdrop-blur-md"
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Jobsite Mission Control</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--app-text-strong)]">
        {jobsiteLabel ?? `Jobsite ${jobsiteId}`}
      </div>
      <div className="mt-3 space-y-2">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-max flex-wrap gap-2">
            {JOBSITE_NAV_PHASES.map((phase) => {
              const firstHref = `/jobsites/${encodeURIComponent(jobsiteId)}/${phase.segments[0]}`;
              const active = phase.id === activePhaseId;
              return (
                <Link
                  key={phase.id}
                  href={firstHref}
                  className={cx(
                    "flex items-center rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition",
                    active
                      ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)] shadow-sm"
                      : "border-transparent bg-white/72 text-[var(--app-text)] hover:bg-white/90 hover:text-[var(--app-text-strong)]"
                  )}
                >
                  {phase.label}
                </Link>
              );
            })}
          </div>
        </div>
        <SegmentedRouteChips items={jobsitePhaseChildLinks(jobsiteId, activePhaseId)} pathname={pathname} />
      </div>
    </div>
  );
}
