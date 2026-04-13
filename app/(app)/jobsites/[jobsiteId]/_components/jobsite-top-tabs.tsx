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
    <div className="sticky top-0 z-20 rounded-2xl border border-slate-700/80 bg-slate-900/92 p-3 backdrop-blur">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Jobsite Workspace
      </div>
      <div className="mb-2 text-xl font-black text-slate-100">Jobsite {jobsiteId}</div>
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
                    ? "bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] text-white"
                    : "border border-slate-600 bg-slate-900/90 text-slate-300 hover:bg-slate-950/50"
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
