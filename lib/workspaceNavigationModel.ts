import type { NavItem, NavSection } from "@/lib/appNavigation";
import type { WorkspaceNavGroup } from "@/lib/workspaceNavGroup";

export type { WorkspaceNavGroup } from "@/lib/workspaceNavGroup";

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

/** Stable rail order for company workspace navigation (used by tests and layout). */
export const WORKSPACE_NAV_GROUP_ORDER: readonly WorkspaceNavGroup[] = [
  "today",
  "audits",
  "documents",
  "fieldSites",
  "programs",
  "insights",
  "account",
];
const GROUP_ORDER = WORKSPACE_NAV_GROUP_ORDER;

const SECTION_META: Record<
  WorkspaceNavGroup,
  Pick<WorkspaceNavSection, "title" | "description" | "audience">
> = {
  today: {
    title: "Today",
    description: "Dashboard, command hub, and submission inbox for daily work.",
    audience: "operator",
  },
  audits: {
    title: "Audits",
    description: "Field audits, audit customers, and audit follow-up work.",
    audience: "field",
  },
  documents: {
    title: "Documents",
    description: "Library, templates, uploads, submissions, search, and safety plan builders.",
    audience: "operator",
  },
  fieldSites: {
    title: "Field & Sites",
    description: "Job sites, JSAs, permits, incidents, and field issue tracking.",
    audience: "field",
  },
  programs: {
    title: "Programs",
    description: "Safety Intelligence, inductions, forms, integrations, and training readiness.",
    audience: "operator",
  },
  insights: {
    title: "Insights",
    description: "Analytics, workflow activity, and reports.",
    audience: "leadership",
  },
  account: {
    title: "Account",
    description: "Billing, team access, profile, and purchases.",
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
    matcher: (href) => href === "/dashboard",
    group: "today",
    description: "Start here for urgent work, progress, and next actions.",
    primaryActionLabel: "Review today",
  },
  {
    matcher: (href) => href === "/command-center",
    group: "today",
    description: "Current risk, open work, and recommended next steps.",
    primaryActionLabel: "Open hub",
  },
  {
    matcher: (href) => href === "/submit" || href === "/upload",
    group: "documents",
    description: "Prepare submissions and upload supporting files into review.",
    primaryActionLabel: "Open inbox",
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
    matcher: (href) => href === "/peshep" || href === "/csep",
    group: "documents",
    description: "Build guided safety document packages from one workflow.",
    primaryActionLabel: "Build document",
  },
  {
    matcher: (href) => href === "/marketplace-preview-approvals",
    group: "documents",
    description: "Review requested document and template previews.",
    primaryActionLabel: "Open previews",
  },
  {
    matcher: (href) => href === "/audit-customers",
    group: "audits",
    description: "Manage audit customers, report contacts, and linked audit jobsites.",
    primaryActionLabel: "Open customers",
  },
  {
    matcher: (href) => href === "/field-audits",
    group: "audits",
    description: "Run field audits, review observations, and manage audit findings.",
    primaryActionLabel: "Open audits",
  },
  {
    matcher: (href) => href === "/jobsites" || href.startsWith("/jobsites/"),
    group: "fieldSites",
    description: "Open project-scoped workspaces, team context, and live activity.",
    primaryActionLabel: "Open jobsite",
  },
  {
    matcher: (href) => href === "/jsa",
    group: "fieldSites",
    description: "Create, review, and manage job safety analyses.",
    primaryActionLabel: "Open JSA builder",
  },
  {
    matcher: (href) => href === "/permits",
    group: "fieldSites",
    description: "Open permit workflows, active stop-work status, and approvals.",
    primaryActionLabel: "Open permits",
  },
  {
    matcher: (href) => href === "/incidents",
    group: "fieldSites",
    description: "Track incident response, escalation, and closure status.",
    primaryActionLabel: "Review incidents",
  },
  {
    matcher: (href) => href === "/field-id-exchange",
    group: "fieldSites",
    description: "Review field issues, corrective actions, and escalations.",
    primaryActionLabel: "Open issue log",
  },
  {
    matcher: (href) => href === "/settings/risk-memory",
    group: "fieldSites",
    description:
      "Manage contractor and crew lists used on incidents, field issues, and Risk Memory rollups.",
    primaryActionLabel: "Open setup",
  },
  {
    matcher: (href) => href === "/safety-intelligence",
    group: "programs",
    description: "Run intake, conflicts, and intelligence-powered safety document workflows.",
    primaryActionLabel: "Start workflow",
  },
  {
    matcher: (href) => href === "/company-inductions",
    group: "programs",
    description: "Configure induction programs and jobsite requirements for site access.",
    primaryActionLabel: "Open induction setup",
  },
  {
    matcher: (href) => href === "/company-safety-forms",
    group: "programs",
    description: "Version safety checklists and publish forms crews run on jobsites.",
    primaryActionLabel: "Open form builder",
  },
  {
    matcher: (href) => href === "/company-integrations",
    group: "programs",
    description: "Webhooks, delivery logs, and HRIS roster import entry points.",
    primaryActionLabel: "Open integrations",
  },
  {
    matcher: (href) => href === "/training-matrix",
    group: "programs",
    description: "Track worker readiness, certifications, and training gaps.",
    primaryActionLabel: "Review gaps",
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
    matcher: (href) => href === "/reports",
    group: "insights",
    description: "Open company reports, summaries, and export-ready management views.",
    primaryActionLabel: "Open reports",
  },
  {
    matcher: (href) => href === "/customer/billing" || href === "/billing",
    group: "account",
    description: "Review billing activity, invoices, payment status, and account charges.",
    primaryActionLabel: "Open billing",
  },
  {
    matcher: (href) => href === "/company-users" || href === "/company-contractors",
    group: "account",
    description: "Manage team members, contractors, invitations, access roles, and permissions.",
    primaryActionLabel: "Open team",
  },
  {
    matcher: (href) => href === "/profile",
    group: "account",
    description: "Update your account profile, contact details, role context, and personal settings.",
    primaryActionLabel: "Open profile",
  },
  {
    matcher: (href) => href === "/purchases",
    group: "account",
    description: "Open purchases, credits, and previously unlocked records.",
    primaryActionLabel: "Review history",
  },
  {
    matcher: (href) =>
      href.startsWith("/analytics/") ||
      href.startsWith("/settings/") ||
      href.startsWith("/billing/") ||
      href.startsWith("/customer/billing/"),
    group: "account",
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
    group: match?.group ?? "insights",
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
