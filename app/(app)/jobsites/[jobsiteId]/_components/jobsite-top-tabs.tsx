"use client";

import { WorkspaceScopedNav } from "@/components/WorkspacePrimitives";

export function JobsiteTopTabs({
  jobsiteId,
}: {
  jobsiteId: string;
}) {
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
    <WorkspaceScopedNav
      eyebrow="Jobsite Workspace"
      title={`Jobsite ${jobsiteId}`}
      tabs={tabs}
      sticky
    />
  );
}
