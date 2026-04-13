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

/** Dedupe by href (first occurrence wins) for command palette and quick pickers. */
export function flattenNavItemsFromSections(
  sections: ReadonlyArray<{ items: readonly NavItem[] }>
): NavItem[] {
  const seen = new Set<string>();
  const out: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (seen.has(item.href)) {
        continue;
      }
      seen.add(item.href);
      out.push(item);
    }
  }
  return out;
}

export const userQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Library", short: "LB" },
  { href: "/submit", label: "Submit", short: "SB" },
  { href: "/upload", label: "Upload", short: "UP" },
];

export const adminQuickLinks: NavItem[] = [
  { href: "/admin", label: "Admin home", short: "AH" },
  { href: "/admin/review-documents", label: "Review queue", short: "RQ" },
  { href: "/admin/users", label: "Users", short: "US" },
  { href: "/admin/companies", label: "Companies", short: "CO" },
  { href: "/billing", label: "Billing", short: "BI" },
  { href: "/admin/sor-audit", label: "SOR audit", short: "SA" },
  { href: "/admin/jobsite-audits", label: "Jobsite audits", short: "JA" },
  { href: "/superadmin/system-test", label: "System test", short: "SY" },
  { href: "/superadmin/injury-weather", label: "Injury weather", short: "IW" },
  { href: "/superadmin/osha-ipa-lab", label: "Compliance tracker", short: "OA" },
];

export const companyAdminQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/company-users", label: "Team", short: "TM" },
  { href: "/training-matrix", label: "Training", short: "TR" },
  { href: "/field-id-exchange", label: "Issues", short: "CA" },
  { href: "/command-center", label: "Command center", short: "CC" },
  { href: "/analytics", label: "Analytics · Risk Memory", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyManagerQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/jobsites", label: "Jobsites", short: "JS" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/purchases", label: "My purchases", short: "MP" },
  { href: "/training-matrix", label: "Training", short: "TR" },
  { href: "/field-id-exchange", label: "Issues", short: "CA" },
  { href: "/command-center", label: "Command center", short: "CC" },
  { href: "/analytics", label: "Analytics · Risk Memory", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyUserQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/library", label: "Documents", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/purchases", label: "My purchases", short: "MP" },
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
      { href: "/submit", label: "Submit document", short: "SB" },
      { href: "/upload", label: "Upload file", short: "UP" },
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
      { href: "/profile", label: "Profile", short: "CP" },
      { href: "/purchases", label: "My purchases", short: "MP" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview review",
        short: "PA",
      },
    ],
  },
];

export const adminSideSections: NavSection[] = [
  {
    title: "Review & approvals",
    items: [
      { href: "/admin", label: "Admin dashboard", short: "AH" },
      { href: "/admin/review-documents", label: "Review queue", short: "RQ" },
      { href: "/admin/sor-audit", label: "SOR audit", short: "SA" },
      { href: "/admin/jobsite-audits", label: "Jobsite audits", short: "JA" },
    ],
  },
  {
    title: "People & records",
    items: [
      { href: "/admin/users", label: "Users", short: "US" },
      { href: "/admin/companies", label: "Companies", short: "CO" },
      { href: "/admin/agreements", label: "Agreements", short: "AG" },
      { href: "/billing", label: "Billing", short: "BI" },
    ],
  },
  {
    title: "Tools & systems",
    items: [
      { href: "/superadmin/system-test", label: "System test", short: "SY" },
      { href: "/superadmin/injury-weather", label: "Injury weather", short: "IW" },
      {
        href: "/superadmin/osha-ipa-lab",
        label: "Compliance tracker",
        short: "OA",
      },
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
      { href: "/profile", label: "Profile", short: "CP" },
    ],
  },
];

export const companyAdminSideSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Documents", short: "DC" },
      {
        href: "/library#library-marketplace",
        label: "Marketplace",
        short: "MK",
      },
      { href: "/purchases", label: "Buy credits", short: "CR" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview review",
        short: "PA",
      },
      { href: "/search", label: "Search documents", short: "SR" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
    ],
  },
  {
    title: "People & account",
    items: [
      { href: "/company-users", label: "Team", short: "US" },
      { href: "/training-matrix", label: "Training", short: "TM" },
      { href: "/profile", label: "Profile", short: "CP" },
    ],
  },
  {
    title: "Safety & programs",
    items: [
      { href: "/field-id-exchange", label: "Issues", short: "CA" },
      { href: "/jsa", label: "JSA", short: "JA" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/command-center", label: "Command center", short: "CC" },
      { href: "/analytics", label: "Analytics · Risk Memory", short: "AN" },
      { href: "/settings/risk-memory", label: "Risk Memory setup", short: "RM" },
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
];

export const companyManagerSideSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Documents", short: "DC" },
      {
        href: "/library#library-marketplace",
        label: "Marketplace",
        short: "MK",
      },
      { href: "/search", label: "Search documents", short: "SR" },
      { href: "/jobsites", label: "Jobsites", short: "JS" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
      { href: "/purchases", label: "My purchases", short: "MP" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview review",
        short: "PA",
      },
      { href: "/training-matrix", label: "Training", short: "TM" },
    ],
  },
  {
    title: "Safety & programs",
    items: [
      { href: "/field-id-exchange", label: "Issues", short: "CA" },
      { href: "/jsa", label: "JSA", short: "JA" },
      { href: "/permits", label: "Permits", short: "PM" },
      { href: "/incidents", label: "Incidents", short: "IN" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/command-center", label: "Command center", short: "CC" },
      { href: "/analytics", label: "Analytics · Risk Memory", short: "AN" },
      { href: "/settings/risk-memory", label: "Risk Memory setup", short: "RM" },
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
    title: "People & account",
    items: [{ href: "/profile", label: "Profile", short: "CP" }],
  },
];

export const companyUserSideSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/library", label: "Documents", short: "DC" },
      {
        href: "/library#library-marketplace",
        label: "Marketplace",
        short: "MK",
      },
      { href: "/search", label: "Search documents", short: "SR" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
      { href: "/purchases", label: "My purchases", short: "MP" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview review",
        short: "PA",
      },
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
    title: "Learn & profile",
    items: [
      { href: "/training-matrix", label: "Training", short: "TM" },
      { href: "/profile", label: "Profile", short: "CP" },
    ],
  },
];

export const accountSetupSideSections: NavSection[] = [
  {
    title: "Getting started",
    items: [
      { href: "/profile", label: "Set up profile", short: "CP" },
      { href: "/company-setup", label: "Create company", short: "CW" },
    ],
  },
];

export const accountSetupQuickLinks: NavItem[] = [
  { href: "/profile", label: "Set up profile", short: "CP" },
  { href: "/company-setup", label: "Create company", short: "CW" },
];

/** Appended in app layout when user has internal admin access outside /admin. */
export const internalAdminAppendedSection: NavSection = {
  title: "Platform",
  items: [
    { href: "/admin", label: "Platform admin", short: "AD" },
    { href: "/billing", label: "Billing", short: "BI" },
  ],
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
