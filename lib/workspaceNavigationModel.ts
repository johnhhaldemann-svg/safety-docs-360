import type { NavItem, NavSection } from "@/lib/appNavigation";

export type WorkspaceNavGroup = "operations" | "documents" | "jobsites" | "admin";

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

const GROUP_ORDER: WorkspaceNavGroup[] = ["operations", "documents", "jobsites", "admin"];

const SECTION_META: Record<
  WorkspaceNavGroup,
  Pick<WorkspaceNavSection, "title" | "description" | "audience">
> = {
  operations: {
    title: "Operations",
    description: "Run daily safety work, triage risk, and keep approvals moving.",
    audience: "operator",
  },
  documents: {
    title: "Documents",
    description: "Open records, search the library, and move submissions forward.",
    audience: "operator",
  },
  jobsites: {
    title: "Jobsites",
    description: "Open live jobsites and jump into project-scoped workspaces.",
    audience: "operator",
  },
  admin: {
    title: "Admin",
    description: "Manage team access, reporting, setup, and account controls.",
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
    description: "Executive snapshot of urgent work, progress, and next actions.",
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
    group: "operations",
    description: "Run intake, conflicts, and AI-powered safety document workflows.",
    primaryActionLabel: "Start workflow",
  },
  {
    matcher: (href) => href === "/field-id-exchange",
    group: "operations",
    description: "Review issues, corrective actions, and field escalations.",
    primaryActionLabel: "Open issues",
  },
  {
    matcher: (href) => href === "/jsa",
    group: "operations",
    description: "Create, review, and manage job safety analyses.",
    primaryActionLabel: "Create JSA",
  },
  {
    matcher: (href) => href === "/permits",
    group: "operations",
    description: "Open permit workflows, active stop-work status, and approvals.",
    primaryActionLabel: "Start permit",
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
    description: "Open previously unlocked records and purchase history.",
    primaryActionLabel: "Review history",
  },
  {
    matcher: (href) => href === "/marketplace-preview-approvals",
    group: "documents",
    description: "Review pending marketplace previews and approval decisions.",
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
    matcher: (href) =>
      href === "/company-users" ||
      href === "/reports" ||
      href === "/analytics" ||
      href.startsWith("/analytics/") ||
      href === "/settings/risk-memory" ||
      href === "/customer/billing" ||
      href === "/billing" ||
      href === "/profile",
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
