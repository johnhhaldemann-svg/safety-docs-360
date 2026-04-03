/**
 * Single source of truth for app shell navigation (sidebar, quick links, setup flows).
 * Keep in sync with route files under app/ — see appNavigationIntegrity.test.ts.
 *
 * Sidebar groups: overview → safety & programs → insights → create & submit → account.
 */

export type NavItem = {
  href: string;
  label: string;
  short: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const userQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Library", short: "LB" },
  { href: "/submit", label: "Submit", short: "SB" },
  { href: "/upload", label: "Upload", short: "UP" },
];

export const adminQuickLinks: NavItem[] = [
  { href: "/admin", label: "Admin home", short: "AH" },
  { href: "/admin/review-documents", label: "Review queue", short: "RQ" },
  { href: "/admin/sor-audit", label: "SOR audit", short: "SA" },
  { href: "/superadmin/injury-weather", label: "Injury weather", short: "IW" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/companies", label: "Companies", short: "CO" },
  { href: "/admin/jobsite-audits", label: "Jobsite audits", short: "JA" },
];

export const companyAdminQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/company-users", label: "Team", short: "TM" },
  { href: "/training-matrix", label: "Training", short: "TR" },
  { href: "/field-id-exchange", label: "Corrective actions", short: "CA" },
  { href: "/analytics", label: "Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyManagerQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/training-matrix", label: "Training", short: "TR" },
  { href: "/field-id-exchange", label: "Corrective actions", short: "CA" },
  { href: "/analytics", label: "Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyUserQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/submit", label: "Submit", short: "SB" },
  { href: "/upload", label: "Upload", short: "UP" },
  { href: "/profile", label: "Profile", short: "CP" },
];

export const userSideSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Library", short: "LB" },
      { href: "/submit", label: "Submit request", short: "SB" },
      { href: "/upload", label: "Upload", short: "UP" },
      { href: "/search", label: "Search", short: "SR" },
    ],
  },
  {
    title: "Program builders",
    items: [
      { href: "/peshep", label: "PESHEP builder", short: "PB" },
      { href: "/csep", label: "CSEP builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "Construction profile", short: "CP" },
      { href: "/purchases", label: "My purchases", short: "MP" },
    ],
  },
];

export const adminSideSections: NavSection[] = [
  {
    title: "Platform admin",
    items: [
      { href: "/admin", label: "Admin dashboard", short: "AH" },
      { href: "/admin/review-documents", label: "Review queue", short: "RQ" },
      { href: "/admin/sor-audit", label: "SOR audit", short: "SA" },
      { href: "/superadmin/injury-weather", label: "Injury weather", short: "IW" },
      { href: "/admin/users", label: "Users", short: "US" },
      { href: "/admin/companies", label: "Companies", short: "CO" },
      { href: "/admin/jobsite-audits", label: "Jobsite audits", short: "JA" },
      { href: "/admin/agreements", label: "Agreements", short: "AG" },
      { href: "/admin/marketplace", label: "Marketplace", short: "MK" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/archive", label: "Archive", short: "AR" },
      { href: "/admin/transactions", label: "Transactions", short: "TX" },
      { href: "/admin/settings", label: "Settings", short: "ST" },
    ],
  },
  {
    title: "Also available",
    items: [
      { href: "/library", label: "Library", short: "LB" },
      { href: "/search", label: "Search", short: "SR" },
      { href: "/profile", label: "Construction profile", short: "CP" },
    ],
  },
];

export const companyAdminSideSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/company-users", label: "Team & users", short: "US" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
    ],
  },
  {
    title: "Safety & programs",
    items: [
      { href: "/field-id-exchange", label: "Corrective actions", short: "CA" },
      { href: "/jsa", label: "JSA", short: "JA" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Create & submit",
    items: [
      { href: "/submit", label: "Submit document", short: "SD" },
      { href: "/upload", label: "Upload file", short: "UF" },
      { href: "/peshep", label: "PESHEP builder", short: "PB" },
      { href: "/csep", label: "CSEP builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction profile", short: "CP" }],
  },
];

export const companyManagerSideSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
    ],
  },
  {
    title: "Safety & programs",
    items: [
      { href: "/field-id-exchange", label: "Corrective actions", short: "CA" },
      { href: "/jsa", label: "JSA", short: "JA" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Create & submit",
    items: [
      { href: "/submit", label: "Submit document", short: "SD" },
      { href: "/upload", label: "Upload file", short: "UF" },
      { href: "/peshep", label: "PESHEP builder", short: "PB" },
      { href: "/csep", label: "CSEP builder", short: "CS" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction profile", short: "CP" }],
  },
];

export const companyUserSideSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Documents", short: "DC" },
      { href: "/training-matrix", label: "Training matrix", short: "TM" },
    ],
  },
  {
    title: "Submit work",
    items: [
      { href: "/submit", label: "Submit document", short: "SD" },
      { href: "/upload", label: "Upload file", short: "UF" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Construction profile", short: "CP" }],
  },
];

export const accountSetupSideSections: NavSection[] = [
  {
    title: "Getting started",
    items: [
      { href: "/profile", label: "Build construction profile", short: "CP" },
      { href: "/company-setup", label: "Create company workspace", short: "CW" },
    ],
  },
];

export const accountSetupQuickLinks: NavItem[] = [
  { href: "/profile", label: "Build construction profile", short: "CP" },
  { href: "/company-setup", label: "Create company workspace", short: "CW" },
];

/** Appended in app layout when user has internal admin access outside /admin. */
export const internalAdminAppendedSection: NavSection = {
  title: "Platform",
  items: [{ href: "/admin", label: "Admin panel", short: "AD" }],
};

const NAV_ITEM_LISTS: { name: string; items: NavItem[] }[] = [
  { name: "userQuickLinks", items: userQuickLinks },
  { name: "adminQuickLinks", items: adminQuickLinks },
  { name: "companyAdminQuickLinks", items: companyAdminQuickLinks },
  { name: "companyManagerQuickLinks", items: companyManagerQuickLinks },
  { name: "companyUserQuickLinks", items: companyUserQuickLinks },
  { name: "accountSetupQuickLinks", items: accountSetupQuickLinks },
];

const NAV_SECTION_LISTS: { name: string; sections: NavSection[] }[] = [
  { name: "userSideSections", sections: userSideSections },
  { name: "adminSideSections", sections: adminSideSections },
  { name: "companyAdminSideSections", sections: companyAdminSideSections },
  { name: "companyManagerSideSections", sections: companyManagerSideSections },
  { name: "companyUserSideSections", sections: companyUserSideSections },
  { name: "accountSetupSideSections", sections: accountSetupSideSections },
  { name: "internalAdminAppendedSection", sections: [internalAdminAppendedSection] },
];

/** Every nav item for integrity checks (deduped hrefs). */
export function collectAllAppNavItems(): NavItem[] {
  const out: NavItem[] = [];
  for (const { items } of NAV_ITEM_LISTS) {
    out.push(...items);
  }
  for (const { sections } of NAV_SECTION_LISTS) {
    for (const s of sections) {
      out.push(...s.items);
    }
  }
  return out;
}

export function getDeclaredAppNavHrefs(): string[] {
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const item of collectAllAppNavItems()) {
    if (!seen.has(item.href)) {
      seen.add(item.href);
      hrefs.push(item.href);
    }
  }
  return hrefs.sort();
}
