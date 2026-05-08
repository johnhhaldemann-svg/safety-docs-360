/**
 * Single source of truth for app shell navigation (sidebar, quick links, setup flows).
 * Keep in sync with route files under app/ - see appNavigationIntegrity.test.ts.
 *
 * Company workspace rail (full product): Today, Audits, Documents, Field & Sites, Programs, Insights, Account.
 */

import type { WorkspaceNavGroup } from "@/lib/workspaceNavGroup";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_NAV_LABEL,
  SITE_SAFETY_BLUEPRINT_NAV_LABEL,
} from "@/lib/safetyBlueprintLabels";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  description?: string;
  keywords?: string[];
  primaryActionLabel?: string;
  audience?: "operator" | "leadership" | "field" | "buyer" | "admin";
};

export type NavSection = {
  title: string;
  group?: WorkspaceNavGroup | "platform" | "review";
  description?: string;
  audience?: "operator" | "leadership" | "field" | "buyer" | "admin";
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
  { href: "/training", label: "Training", short: "PT" },
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
];

export const companyAdminQuickLinks: NavItem[] = [
  {
    href: "/command-center",
    label: "Command Center",
    short: "CC",
    description: "Current risk, open work, and recommended next steps.",
    primaryActionLabel: "Open hub",
    audience: "operator",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "DB",
    description: "Executive snapshot of urgent work, progress, and platform status.",
    primaryActionLabel: "Review today",
    audience: "leadership",
  },
  { href: "/jobsites", label: "Job Sites", short: "JS" },
  {
    href: "/audit-customers",
    label: "Audit Customers",
    short: "AC",
    description: "Customer companies, report emails, and linked audit jobsites.",
    primaryActionLabel: "Open directory",
    audience: "operator",
  },
  { href: "/library", label: "Document Library", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/training", label: "Training", short: "PT" },
  { href: "/company-users", label: "Team & Access", short: "TM" },
  { href: "/training-matrix", label: "Training Tracker", short: "TR" },
  { href: "/field-id-exchange", label: "Field Issues", short: "CA" },
  { href: "/safety-intelligence", label: "Safety Intelligence", short: "SI" },
  { href: "/analytics/safety-intelligence", label: "Workflow Activity", short: "WA" },
  { href: "/analytics/predictive-model", label: "Predictive Model", short: "PM" },
  { href: "/analytics", label: "Safety Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyManagerQuickLinks: NavItem[] = [
  {
    href: "/command-center",
    label: "Command Center",
    short: "CC",
    description: "Current risk, open work, and recommended next steps.",
    primaryActionLabel: "Open hub",
    audience: "operator",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "DB",
    description: "Executive snapshot of urgent work, progress, and platform status.",
    primaryActionLabel: "Review today",
    audience: "leadership",
  },
  { href: "/jobsites", label: "Job Sites", short: "JS" },
  {
    href: "/audit-customers",
    label: "Audit Customers",
    short: "AC",
    description: "Customer companies, report emails, and linked audit jobsites.",
    primaryActionLabel: "Open directory",
    audience: "operator",
  },
  { href: "/library", label: "Document Library", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/purchases", label: "Purchases", short: "MP" },
  { href: "/training", label: "Training", short: "PT" },
  { href: "/training-matrix", label: "Training Tracker", short: "TR" },
  { href: "/field-id-exchange", label: "Field Issues", short: "CA" },
  { href: "/safety-intelligence", label: "Safety Intelligence", short: "SI" },
  { href: "/analytics/safety-intelligence", label: "Workflow Activity", short: "WA" },
  { href: "/analytics/predictive-model", label: "Predictive Model", short: "PM" },
  { href: "/analytics", label: "Safety Analytics", short: "AN" },
  { href: "/reports", label: "Reports", short: "RP" },
];

export const companyUserQuickLinks: NavItem[] = [
  { href: "/dashboard", label: "Home Dashboard", short: "DB" },
  { href: "/field-audits", label: "Field Audits", short: "FA" },
  { href: "/library", label: "Document Library", short: "DC" },
  { href: "/search", label: "Search", short: "SR" },
  { href: "/customer/billing", label: "Billing", short: "BL" },
  { href: "/purchases", label: "Purchases", short: "MP" },
  { href: "/training", label: "Training", short: "PT" },
  { href: "/submit", label: "Submit for Review", short: "SB" },
  { href: "/upload", label: "Upload Documents", short: "UP" },
  { href: "/profile", label: "My Profile", short: "CP" },
];

export const userSideSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Home Dashboard", short: "HM" },
      { href: "/training", label: "Training", short: "PT" },
    ],
  },
  {
    title: "Documents",
    items: [
      { href: "/library", label: "Document Library", short: "LB" },
      { href: "/submit", label: "Submit for Review", short: "SB" },
      { href: "/upload", label: "Upload Documents", short: "UP" },
      { href: "/search", label: "Search", short: "SR" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview Requests",
        short: "PA",
      },
      { href: "/peshep", label: SITE_SAFETY_BLUEPRINT_NAV_LABEL, short: "DS" },
      { href: "/csep", label: CONTRACTOR_SAFETY_BLUEPRINT_NAV_LABEL, short: "DC" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "My Profile", short: "CP" },
      { href: "/purchases", label: "Purchases", short: "MP" },
    ],
  },
];

export const adminSideSections: NavSection[] = [
  {
    title: "Review",
    description: "Queues that need an internal decision first.",
    audience: "admin",
    items: [
      {
        href: "/admin",
        label: "Admin Dashboard",
        short: "AH",
        description: "Review the whole admin board and next highest-value action.",
        primaryActionLabel: "Open admin home",
        audience: "admin",
      },
      {
        href: "/admin/review-documents",
        label: "Document Review Queue",
        short: "RQ",
        description: "Review submitted documents, approve final files, and manage review flow.",
        primaryActionLabel: "Open queue",
        audience: "admin",
      },
    ],
  },
  {
    title: "Documents",
    description: "Template, library, archive, and marketplace controls.",
    audience: "admin",
    items: [
      { href: "/admin/marketplace", label: "Marketplace Admin", short: "MK" },
      { href: "/admin/archive", label: "Archive", short: "AR" },
      { href: "/library", label: "Library", short: "LB" },
      { href: "/search", label: "Search", short: "SR" },
    ],
  },
  {
    title: "Companies & Users",
    description: "Customer accounts, users, agreements, and access.",
    audience: "admin",
    items: [
      { href: "/admin/users", label: "Users", short: "US" },
      { href: "/admin/companies", label: "Companies", short: "CO" },
      { href: "/admin/agreements", label: "Agreements", short: "AG" },
    ],
  },
  {
    title: "Billing",
    description: "Invoices, transactions, and customer billing support.",
    audience: "admin",
    items: [
      { href: "/billing", label: "Billing", short: "BI" },
      { href: "/admin/transactions", label: "Transactions", short: "TX" },
    ],
  },
  {
    title: "Audits",
    description: "Audit review tools and field audit administration.",
    audience: "admin",
    items: [
      { href: "/admin/sor-audit", label: "SOR Audit", short: "SA" },
      { href: "/admin/jobsite-audits", label: "Jobsite Audits", short: "JA" },
    ],
  },
  {
    title: "System Tools",
    description: "Admin settings and platform operating controls.",
    audience: "admin",
    items: [
      { href: "/admin/settings", label: "Settings", short: "ST" },
    ],
  },
  {
    title: "Also available",
    items: [
      { href: "/profile", label: "Profile", short: "CP" },
    ],
  },
];

export const superadminOnlySideSections: NavSection[] = [
  {
    title: "Superadmin",
    description: "Restricted diagnostics, validation, and AI operations.",
    audience: "admin",
    items: [
      { href: "/superadmin/ai-engine", label: "AI Engine Operations", short: "AI" },
      { href: "/superadmin/prediction-validation", label: "Prediction validation", short: "PV" },
      { href: "/superadmin/system-test", label: "System Test", short: "SY" },
      { href: "/superadmin/system-health", label: "System Health", short: "SH" },
      { href: "/superadmin/csep-survey-test", label: "Survey Test CSEP", short: "ST" },
      { href: "/superadmin/csep-completeness-review", label: "CSEP Completeness Review", short: "CR" },
      { href: "/superadmin/builder-text", label: "Builder Text", short: "BT" },
      {
        href: "/superadmin/jurisdiction-standards",
        label: "Jurisdiction Standards",
        short: "JS",
      },
      { href: "/superadmin/injury-weather", label: "Injury Weather", short: "IW" },
      {
        href: "/superadmin/osha-ipa-lab",
        label: "Compliance Tracker",
        short: "OA",
      },
    ],
  },
];

export const companyAdminSideSections: NavSection[] = [
  {
    title: "Start Here",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/purchases", label: "Purchases & Credits", short: "CR" },
      { href: "/jobsites", label: "Job Sites", short: "JS" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
    ],
  },
  {
    title: "Documents",
    items: [
      { href: "/library", label: "Document Library", short: "DC" },
      {
        href: "/library?tab=marketplace",
        label: "Template Marketplace",
        short: "MK",
      },
      { href: "/search", label: "Search", short: "SR" },
      { href: "/submit", label: "Submit for Review", short: "SD" },
      { href: "/upload", label: "Upload Documents", short: "UF" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview Requests",
        short: "PA",
      },
      { href: "/peshep", label: SITE_SAFETY_BLUEPRINT_NAV_LABEL, short: "DS" },
      { href: "/csep", label: CONTRACTOR_SAFETY_BLUEPRINT_NAV_LABEL, short: "DC" },
    ],
  },
  {
    title: "Audits",
    items: [
      { href: "/audit-customers", label: "Audit Customers", short: "AC" },
      { href: "/field-audits", label: "Field Audits", short: "FA" },
    ],
  },
  {
    title: "Programs & Training",
    items: [
      { href: "/company-users", label: "Team & Access", short: "US" },
      { href: "/training", label: "Platform Training", short: "PT" },
      { href: "/company-contractors", label: "Contractor compliance", short: "CQ" },
      { href: "/training-matrix", label: "Training Tracker", short: "TM" },
      { href: "/company-inductions", label: "Inductions", short: "IN" },
      { href: "/company-safety-forms", label: "Safety Forms", short: "SF" },
      { href: "/company-integrations", label: "Integrations", short: "IG" },
    ],
  },
  {
    title: "Field & Sites",
    items: [
      { href: "/field-id-exchange", label: "Field Issues", short: "CA" },
      { href: "/jsa", label: "JSA Builder", short: "JA" },
      { href: "/permits", label: "Permit Center", short: "PM" },
      { href: "/incidents", label: "Incident Log", short: "IN" },
    ],
  },
  {
    title: "Insights & Reports",
    items: [
      { href: "/command-center", label: "Command Center", short: "CC" },
      { href: "/safety-intelligence", label: "Safety Intelligence", short: "SI" },
      { href: "/analytics/safety-intelligence", label: "Workflow Activity", short: "WA" },
      { href: "/analytics/predictive-model", label: "Predictive Model", short: "PM" },
      { href: "/safe-predict", label: "SafePredict AI", short: "SP" },
      { href: "/analytics", label: "Safety Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "My Profile", short: "CP" },
    ],
  },
];

export const companyManagerSideSections: NavSection[] = [
  {
    title: "Start Here",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Job Sites", short: "JS" },
      { href: "/training", label: "Platform Training", short: "PT" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
      { href: "/purchases", label: "Purchases", short: "MP" },
      { href: "/training-matrix", label: "Training Tracker", short: "TM" },
    ],
  },
  {
    title: "Documents",
    items: [
      { href: "/library", label: "Document Library", short: "DC" },
      {
        href: "/library?tab=marketplace",
        label: "Template Marketplace",
        short: "MK",
      },
      { href: "/search", label: "Search", short: "SR" },
      { href: "/submit", label: "Submit for Review", short: "SD" },
      { href: "/upload", label: "Upload Documents", short: "UF" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview Requests",
        short: "PA",
      },
      { href: "/peshep", label: SITE_SAFETY_BLUEPRINT_NAV_LABEL, short: "DS" },
      { href: "/csep", label: CONTRACTOR_SAFETY_BLUEPRINT_NAV_LABEL, short: "DC" },
    ],
  },
  {
    title: "Audits",
    items: [
      { href: "/audit-customers", label: "Audit Customers", short: "AC" },
      { href: "/field-audits", label: "Field Audits", short: "FA" },
    ],
  },
  {
    title: "Field & Sites",
    items: [
      { href: "/field-id-exchange", label: "Field Issues", short: "CA" },
      { href: "/jsa", label: "JSA Builder", short: "JA" },
      { href: "/permits", label: "Permit Center", short: "PM" },
      { href: "/incidents", label: "Incident Log", short: "IN" },
    ],
  },
  {
    title: "Programs & Training",
    items: [
      { href: "/company-inductions", label: "Inductions", short: "IN" },
      { href: "/company-safety-forms", label: "Safety Forms", short: "SF" },
      { href: "/company-integrations", label: "Integrations", short: "IG" },
    ],
  },
  {
    title: "Insights & Reports",
    items: [
      { href: "/command-center", label: "Command Center", short: "CC" },
      { href: "/safety-intelligence", label: "Safety Intelligence", short: "SI" },
      { href: "/analytics/safety-intelligence", label: "Workflow Activity", short: "WA" },
      { href: "/analytics/predictive-model", label: "Predictive Model", short: "PM" },
      { href: "/safe-predict", label: "SafePredict AI", short: "SP" },
      { href: "/analytics", label: "Safety Analytics", short: "AN" },
      { href: "/reports", label: "Reports", short: "RP" },
    ],
  },
  {
    title: "Profile",
    items: [{ href: "/profile", label: "My Profile", short: "CP" }],
  },
];

export const companyUserSideSections: NavSection[] = [
  {
    title: "Start Here",
    items: [
      { href: "/dashboard", label: "Dashboard", short: "HM" },
      { href: "/jobsites", label: "Job Sites", short: "JS" },
      { href: "/customer/billing", label: "Billing", short: "BL" },
      { href: "/purchases", label: "Purchases", short: "MP" },
    ],
  },
  {
    title: "Documents",
    items: [
      { href: "/library", label: "Document Library", short: "DC" },
      {
        href: "/library?tab=marketplace",
        label: "Template Marketplace",
        short: "MK",
      },
      { href: "/search", label: "Search", short: "SR" },
      { href: "/submit", label: "Submit for Review", short: "SD" },
      { href: "/upload", label: "Upload Documents", short: "UF" },
      {
        href: "/marketplace-preview-approvals",
        label: "Preview Requests",
        short: "PA",
      },
    ],
  },
  {
    title: "Field & Sites",
    items: [
      { href: "/field-audits", label: "Field Audits", short: "FA" },
      { href: "/jsa", label: "JSA Builder", short: "JA" },
    ],
  },
  {
    title: "Programs & Training",
    items: [
      { href: "/training", label: "Platform Training", short: "PT" },
      { href: "/training-matrix", label: "Training Tracker", short: "TM" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "My Profile", short: "CP" },
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
  { name: "superadminOnlySideSections", sections: superadminOnlySideSections },
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

