export type TrainingResource = {
  id: string;
  title: string;
  shortTitle: string;
  audience: string;
  estimatedTime: string;
  description: string;
  downloadPath: string;
  outcomes: string[];
  relatedLinks: Array<{
    label: string;
    href: string;
  }>;
};

export const trainingResources: TrainingResource[] = [
  {
    id: "getting-started",
    title: "Getting Started With Safety360Docs",
    shortTitle: "Getting Started",
    audience: "All users",
    estimatedTime: "10 min",
    description:
      "A practical first walkthrough for logging in, setting up a profile, reading the dashboard, searching, and moving around the workspace.",
    downloadPath: "/training/safety360docs-getting-started.pptx",
    outcomes: [
      "Sign in and confirm account readiness.",
      "Complete the profile fields that power team and training views.",
      "Use the dashboard, search, and sidebar without getting lost.",
    ],
    relatedLinks: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Profile", href: "/profile" },
      { label: "Search", href: "/search" },
    ],
  },
  {
    id: "documents-marketplace",
    title: "Documents, Library, And Marketplace",
    shortTitle: "Documents",
    audience: "Document owners",
    estimatedTime: "14 min",
    description:
      "How teams find approved records, use marketplace templates, upload files, submit work for review, and build guided safety plan packages.",
    downloadPath: "/training/safety360docs-documents-marketplace.pptx",
    outcomes: [
      "Find completed documents and unlocked templates.",
      "Upload, submit, and track document review status.",
      "Understand where PESH and CSEP builders fit in the document workflow.",
    ],
    relatedLinks: [
      { label: "Documents", href: "/documents" },
      { label: "Template Marketplace", href: "/library?tab=marketplace" },
      { label: "Upload Documents", href: "/upload" },
      { label: "Submit For Review", href: "/submit" },
      { label: "PESH Builder", href: "/peshep" },
      { label: "CSEP Builder", href: "/csep" },
    ],
  },
  {
    id: "field-work",
    title: "Field Workflows For Jobsites",
    shortTitle: "Field Work",
    audience: "Field teams",
    estimatedTime: "15 min",
    description:
      "A field-focused guide for jobsites, audits, JSA work, permits, incidents, and the field issue log.",
    downloadPath: "/training/safety360docs-field-work.pptx",
    outcomes: [
      "Open jobsite workspaces and field records.",
      "Use audits, JSAs, permits, and incidents for daily control.",
      "Turn field issues into visible follow-up work.",
    ],
    relatedLinks: [
      { label: "Job Sites", href: "/jobsites" },
      { label: "Field Audits", href: "/field-audits" },
      { label: "JSA Builder", href: "/jsa" },
      { label: "Permit Center", href: "/permits" },
      { label: "Incident Log", href: "/incidents" },
      { label: "Field Issue Log", href: "/field-id-exchange" },
    ],
  },
  {
    id: "training-tracker-team-access",
    title: "Training Tracker And Team Access",
    shortTitle: "Training Tracker",
    audience: "Admins and supervisors",
    estimatedTime: "12 min",
    description:
      "How team profiles, roles, certifications, requirements, and contractor compliance connect into one readiness view.",
    downloadPath: "/training/safety360docs-training-tracker-team-access.pptx",
    outcomes: [
      "Invite and manage team access responsibly.",
      "Keep profiles and certification expirations current.",
      "Use the training tracker to spot gaps before work starts.",
    ],
    relatedLinks: [
      { label: "Team & Access", href: "/company-users" },
      { label: "Training Tracker", href: "/training-matrix" },
      { label: "Contractor Compliance", href: "/company-contractors" },
      { label: "My Profile", href: "/profile" },
    ],
  },
  {
    id: "insights-admin",
    title: "Insights, Safety Intelligence, And Admin Basics",
    shortTitle: "Insights",
    audience: "Leaders and admins",
    estimatedTime: "16 min",
    description:
      "A leadership walkthrough for the command center, Safety Intelligence, analytics, reports, billing, and admin review routines.",
    downloadPath: "/training/safety360docs-insights-admin.pptx",
    outcomes: [
      "Use the command center to prioritize daily prevention work.",
      "Connect Safety Intelligence workflows to reports and analytics.",
      "Know where billing, admin review, and system health work lives.",
    ],
    relatedLinks: [
      { label: "Command Center", href: "/command-center" },
      { label: "Safety Intelligence", href: "/safety-intelligence" },
      { label: "Safety Analytics", href: "/analytics" },
      { label: "Reports", href: "/reports" },
      { label: "Billing", href: "/customer/billing" },
    ],
  },
];

export const trainingDeckCount = trainingResources.length;
