"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function JobsiteTopTabs({
  jobsiteId,
}: {
  jobsiteId: string;
}) {
  const pathname = usePathname();
  const base = `/jobsites/${encodeURIComponent(jobsiteId)}`;
  const tabs = [
    { href: `${base}/overview`, label: "Overview" },
    { href: `${base}/live-view`, label: "Live View" },
    { href: `${base}/jsa`, label: "JSA" },
    { href: `${base}/permits`, label: "Permits" },
    { href: `${base}/incidents`, label: "Incidents" },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/analytics`, label: "Analytics" },
    { href: `${base}/team`, label: "Team" },
  ];

  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-[var(--app-border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(241,247,255,0.95)_100%)] p-3 shadow-[var(--app-shadow-soft)] backdrop-blur-md">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
        Jobsite Workspace
      </div>
      <div className="mb-2 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]">Jobsite {jobsiteId}</div>
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-max gap-2">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cx(
                  "rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition",
                  active
                    ? "bg-[var(--app-accent-primary)] text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
                    : "border border-[var(--app-border)] bg-white/90 text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-accent-primary-soft)]"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
