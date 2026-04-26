"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SegmentedRouteChips } from "@/components/AppTabBar";
import {
  JOBSITE_NAV_PHASES,
  getJobsiteWorkspacePhaseId,
  jobsitePhaseChildLinks,
} from "@/lib/jobsiteWorkspaceNav";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function JobsiteTopTabs({
  jobsiteId,
}: {
  jobsiteId: string;
}) {
  const pathname = usePathname();
  const activePhaseId = getJobsiteWorkspacePhaseId(pathname) ?? "overview";

  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_#f7fbff_0%,_#edf4ff_55%,_#e7f0fb_100%)] p-4 shadow-[var(--app-shadow-soft)]",
        "sticky top-0 z-20 backdrop-blur-md"
      )}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Job site Workspace</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]">
        Job site {jobsiteId}
      </div>
      <div className="mt-4 space-y-3">
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
                    "flex items-center rounded-2xl border px-4 py-3 text-sm font-semibold whitespace-nowrap transition",
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
