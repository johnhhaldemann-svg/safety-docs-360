/** Stored in `company_subscriptions.plan_name` for CSEP-only (comped / limited) workspaces. */
export const CSEP_PLAN_NAME = "CSEP";

export type WorkspaceProduct = "full" | "csep";

/** Matches `NavSection` in appNavigation (avoid circular imports). */
export type NavSectionLike = {
  title: string;
  items: { href: string; label: string; short: string }[];
};

export function planNameToWorkspaceProduct(planName: string | null | undefined): WorkspaceProduct {
  if ((planName ?? "").trim() === CSEP_PLAN_NAME) {
    return "csep";
  }
  return "full";
}

/** Normalize plan from admin approve UI: CSEP or standard commercial labels. */
export function normalizeApprovalPlanName(input: string | undefined | null): string {
  const t = (input ?? "").trim();
  if (t === CSEP_PLAN_NAME) {
    return CSEP_PLAN_NAME;
  }
  if (!t) {
    return "Pro";
  }
  return t;
}

export function isCsepWorkspaceProduct(product: WorkspaceProduct): boolean {
  return product === "csep";
}

/** Sidebar for CSEP-only companies (full product uses role-specific sections in appNavigation). */
export const csepOnlyCompanySideSections: NavSectionLike[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/csep", label: "CSEP builder", short: "CS" },
      { href: "/library", label: "Completed documents", short: "LB" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction profile", short: "CP" }],
  },
];

const csepReadOnlySideSections: NavSectionLike[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Completed documents", short: "LB" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction profile", short: "CP" }],
  },
];

export function getCsepNavSectionsForRole(userRole: string): NavSectionLike[] {
  if (userRole.trim().toLowerCase() === "read_only") {
    return csepReadOnlySideSections;
  }
  return csepOnlyCompanySideSections;
}
