import type { NavItem, NavSection } from "@/lib/appNavigation";

export type WorkspaceNavGroup = "operations" | "insights" | "documents" | "jobsites" | "admin";

export type WorkspaceNavItem = NavItem & {
  group: WorkspaceNavGroup;
  description: string;
  primaryActionLabel?: string;
};

export type WorkspaceNavSection = NavSection & {
  group: WorkspaceNavGroup;
  description: string;
  audience: "operator" | "leadership" | "field";
  items: WorkspaceNavItem[];
};

const GROUP_ORDER: WorkspaceNavGroup[] = ["operations", "insights", "documents", "jobsites", "admin"];

const SECTION_META: Record<
  WorkspaceNavGroup,
  Pick<WorkspaceNavSection, "title" | "description" | "audience">
> = {
  operations: {
    title: "Operations",
    description: "Run daily safety work, triage risk, and keep approvals moving.",
    audience: "operator",
  },
  insights: {
    title: "Insights & intelligence",
    description: "Safety Intelligence, company-wide analytics, and risk program context.",
    audience: "leadership",
  },
  documents: {
    title: "Documents",
    description: "Open records, search the library, and move submissions forward.",
    audience: "operator",
  },
  jobsites: {
    title: "Job Sites",
    description: "Open live jobsites and jump into project-scoped workspaces.",
    audience: "operator",
  },
  admin: {
    title: "Account & reports",
    description: "Open billing, team access, reports, and account settings.",
    audience: "leadership",
  },
};

const ITEM_META: Array<{
  matcher: (href: string) => boolean;
  group: WorkspaceNavGroup;
  description: string;
  primaryActionLabel?: string;
}> = [
  {
    matcher: (href) => href === "/command-center",
    group: "operations",
    description: "Current risk, open work, and recommended next steps.",
    primaryActionLabel: "Open hub",
  },
  {
    matcher: (href) => href === "/dashboard",
    group: "operations",
    description: "Start here for urgent work, progress, and next actions.",
    primaryActionLabel: "Review today",
  },
  {
    matcher: (href) => href === "/training-matrix",
    group: "operations",
    description: "Track worker readiness, certifications, and training gaps.",
    primaryActionLabel: "Review gaps",
  },
  {
    matcher: (href) => href === "/safety-intelligence",
    group: "insights",
    description: "Run intake, conflicts, and intelligence-powered safety document workflows.",
    primaryActionLabel: "Start workflow",
  },
  {
    matcher: (href) => href === "/field-id-exchange",
    group: "operations",
    description: "Review field issues, corrective actions, and escalations.",
    primaryActionLabel: "Open issue log",
  },
  {
    matcher: (href) => href === "/jsa",
    group: "operations",
    description: "Create, review, and manage job safety analyses.",
    primaryActionLabel: "Open JSA builder",
  },
  {
    matcher: (href) => href === "/company-inductions",
    group: "operations",
    description: "Configure induction programs and jobsite requirements for site access.",
    primaryActionLabel: "Open induction setup",
  },
  {
    matcher: (href) => href === "/company-safety-forms",
    group: "operations",
    description: "Version safety checklists and publish forms crews run on jobsites.",
    primaryActionLabel: "Open form builder",
  },
  {
    matcher: (href) => href === "/company-integrations",
    group: "admin",
    description: "Webhooks, delivery logs, and HRIS roster import entry points.",
    primaryActionLabel: "Open integrations",
  },
  {
    matcher: (href) => href === "/permits",
    group: "operations",
    description: "Open permit workflows, active stop-work status, and approvals.",
    primaryActionLabel: "Open permits",
  },
  {
    matcher: (href) => href === "/incidents",
    group: "operations",
    description: "Track incident response, escalation, and closure status.",
    primaryActionLabel: "Review incidents",
  },
  {
    matcher: (href) => href.startsWith("/library"),
    group: "documents",
    description: "Browse finished records, templates, and marketplace content.",
    primaryActionLabel: "Open documents",
  },
  {
    matcher: (href) => href === "/search",
    group: "documents",
    description: "Search documents, records, projects, and saved pages.",
    primaryActionLabel: "Search now",
  },
  {
    matcher: (href) => href === "/submit",
    group: "documents",
    description: "Prepare a submission package and send it into review.",
    primaryActionLabel: "Submit package",
  },
  {
    matcher: (href) => href === "/upload",
    group: "documents",
    description: "Add source files, supporting records, and templates.",
    primaryActionLabel: "Upload files",
  },
  {
    matcher: (href) => href === "/purchases",
    group: "documents",
    description: "Open purchases, credits, and previously unlocked records.",
    primaryActionLabel: "Review history",
  },
  {
    matcher: (href) => href === "/marketplace-preview-approvals",
    group: "documents",
    description: "Review marketplace preview requests and approval decisions.",
    primaryActionLabel: "Review previews",
  },
  {
    matcher: (href) => href === "/peshep" || href === "/csep",
    group: "documents",
    description: "Build guided safety document packages from one workflow.",
    primaryActionLabel: "Build document",
  },
  {
    matcher: (href) => href === "/jobsites" || href.startsWith("/jobsites/"),
    group: "jobsites",
    description: "Open project-scoped workspaces, team context, and live activity.",
    primaryActionLabel: "Open jobsite",
  },
  {
    matcher: (href) => href === "/customer/billing" || href === "/billing",
    group: "admin",
    description: "Review billing activity, invoices, payment status, and account charges.",
    primaryActionLabel: "Open billing",
  },
  {
    matcher: (href) => href === "/company-users",
    group: "admin",
    description: "Manage team members, invitations, access roles, and company user permissions.",
    primaryActionLabel: "Open team",
  },
  {
    matcher: (href) => href === "/profile",
    group: "admin",
    description: "Update your account profile, contact details, role context, and personal settings.",
    primaryActionLabel: "Open profile",
  },
  {
    matcher: (href) => href === "/analytics/safety-intelligence",
    group: "insights",
    description:
      "Safety Intelligence workload for your company: volumes, reviews, rule conflicts, and recurring task and hazard signals.",
    primaryActionLabel: "View activity",
  },
  {
    matcher: (href) => href === "/analytics",
    group: "insights",
    description:
      "Company-wide safety analytics: observations, incidents, injury analytics, and Risk Memory signals you can act on.",
    primaryActionLabel: "Open analytics",
  },
  {
    matcher: (href) => href === "/settings/risk-memory",
    group: "operations",
    description:
      "Manage contractor and crew lists used on incidents, field issues, and Risk Memory rollups.",
    primaryActionLabel: "Open setup",
  },
  {
    matcher: (href) => href === "/reports",
    group: "admin",
    description: "Open company reports, summaries, and export-ready management views.",
    primaryActionLabel: "Open reports",
  },
  {
    matcher: (href) =>
      href.startsWith("/analytics/") ||
      href.startsWith("/settings/") ||
      href.startsWith("/billing/") ||
      href.startsWith("/customer/billing/"),
    group: "admin",
    description: "Manage workspace controls, analytics, reporting, and account details.",
    primaryActionLabel: "Open controls",
  },
];

function normalizeHref(href: string) {
  return href.split("#")[0] ?? href;
}

export function getWorkspaceNavItemMeta(item: NavItem): WorkspaceNavItem {
  const href = normalizeHref(item.href);
  const match = ITEM_META.find((entry) => entry.matcher(href));
  return {
    ...item,
    group: match?.group ?? "documents",
    description: match?.description ?? "Open this workspace area.",
    primaryActionLabel: item.primaryActionLabel ?? match?.primaryActionLabel,
  };
}

/** Sidebar entries omitted intentionally; header/breadcrumbs still resolve from pathname. */
const ORPHAN_COMPANY_WORKSPACE_NAV: Record<string, Pick<NavItem, "label" | "short">> = {
  "/settings/risk-memory": { label: "Risk Memory setup", short: "RM" },
};

export function getOrphanCompanyWorkspaceNav(pathname: string): {
  item: NavItem;
  sectionTitle: string;
  sectionKey: string;
} | null {
  const href = normalizeHref(pathname);
  const extra = ORPHAN_COMPANY_WORKSPACE_NAV[href];
  if (!extra) return null;
  const meta = getWorkspaceNavItemMeta({ href, label: extra.label, short: extra.short });
  return {
    item: { href, label: extra.label, short: extra.short },
    sectionTitle: SECTION_META[meta.group].title,
    sectionKey: `orphan-${meta.group}`,
  };
}

export function groupCompanyWorkspaceSections(sections: NavSection[]): WorkspaceNavSection[] {
  const grouped = new Map<WorkspaceNavGroup, WorkspaceNavItem[]>();

  for (const section of sections) {
    for (const item of section.items) {
      const meta = getWorkspaceNavItemMeta(item);
      const existing = grouped.get(meta.group) ?? [];
      if (!existing.some((entry) => entry.href === meta.href)) {
        existing.push(meta);
      }
      grouped.set(meta.group, existing);
    }
  }

  return GROUP_ORDER.map((group) => {
    const items = grouped.get(group) ?? [];
    if (items.length === 0) {
      return null;
    }

    const meta = SECTION_META[group];
    return {
      title: meta.title,
      group,
      description: meta.description,
      audience: meta.audience,
      items,
    } satisfies WorkspaceNavSection;
  }).filter((section): section is WorkspaceNavSection => section != null);
}
