export type JobsiteNavPhase = {
  id: string;
  label: string;
  /** Last path segment after `/jobsites/[id]/` */
  segments: readonly string[];
};

export const JOBSITE_NAV_PHASES: readonly JobsiteNavPhase[] = [
  { id: "overview", label: "Overview", segments: ["overview", "live-view", "team"] },
  { id: "field_work", label: "Field work", segments: ["jsa", "toolbox", "permits", "inductions"] },
  { id: "compliance", label: "Compliance", segments: ["safety-forms", "incidents", "chemicals"] },
  { id: "documents", label: "Documents", segments: ["documents", "reports"] },
  { id: "insights", label: "Insights", segments: ["analytics", "safety-intelligence"] },
] as const;

/** Jobsite id from pathname `/jobsites/:id/...` or null. */
export function parseJobsiteIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/jobsites\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function getJobsiteWorkspacePhaseId(pathname: string): (typeof JOBSITE_NAV_PHASES)[number]["id"] | null {
  const jobsiteId = parseJobsiteIdFromPath(pathname);
  if (!jobsiteId) return null;
  const prefix = `/jobsites/${jobsiteId}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split("/")[0] ?? "";
  for (const phase of JOBSITE_NAV_PHASES) {
    if (phase.segments.includes(rest)) {
      return phase.id;
    }
  }
  return null;
}

export function jobsitePhaseChildLinks(jobsiteId: string, phaseId: string): { href: string; label: string }[] {
  const base = `/jobsites/${encodeURIComponent(jobsiteId)}`;
  const phase = JOBSITE_NAV_PHASES.find((p) => p.id === phaseId);
  if (!phase) return [];
  return phase.segments.map((seg) => ({
    href: `${base}/${seg}`,
    label: segmentLabel(seg),
  }));
}

function segmentLabel(segment: string) {
  const map: Record<string, string> = {
    overview: "Overview",
    "live-view": "Live view",
    team: "Team",
    jsa: "JSA",
    toolbox: "Toolbox",
    permits: "Permits",
    inductions: "Inductions",
    "safety-forms": "Safety forms",
    incidents: "Incidents",
    chemicals: "Chemicals",
    documents: "Documents",
    reports: "Reports",
    analytics: "Analytics",
    "safety-intelligence": "Safety Intelligence",
  };
  return map[segment] ?? segment;
}
