export type SuperadminNavItem = {
  href: string;
  label: string;
  short: string;
  description: string;
  keywords: string[];
  primaryActionLabel: string;
  audience: "admin";
};

export type SuperadminNavSection = {
  title: string;
  description: string;
  audience: "admin";
  items: SuperadminNavItem[];
};

export const superadminToolGroups: SuperadminNavSection[] = [
  {
    title: "Superadmin Home",
    description: "Start here for restricted platform operations and tool discovery.",
    audience: "admin",
    items: [
      {
        href: "/superadmin",
        label: "Superadmin Hub",
        short: "SA",
        description: "Search restricted tools and open common superadmin workflows from one place.",
        keywords: ["superadmin", "home", "hub", "platform", "tools", "search"],
        primaryActionLabel: "Open hub",
        audience: "admin",
      },
    ],
  },
  {
    title: "Monitor",
    description: "Platform health, diagnostics, and end-to-end operating checks.",
    audience: "admin",
    items: [
      {
        href: "/superadmin/health",
        label: "Health Command Center",
        short: "HC",
        description: "Review connected health score, event ledger, owners, changes, and source-linked tickets.",
        keywords: ["health", "command", "score", "events", "owners", "changes", "tickets"],
        primaryActionLabel: "Open health",
        audience: "admin",
      },
      {
        href: "/superadmin/owner-validation",
        label: "Owner Validation Console",
        short: "OV",
        description: "See module status, sandbox readiness, owner review needs, and customer-ready signals.",
        keywords: ["owner", "validation", "customer-ready", "sandbox", "qa", "review", "proof"],
        primaryActionLabel: "Open console",
        audience: "admin",
      },
      {
        href: "/superadmin/what-changed",
        label: "What Changed?",
        short: "WC",
        description: "Review plain-English platform changes, owner review needs, affected pages, and customer-ready status.",
        keywords: ["changes", "release", "log", "owner", "review", "customer-ready", "deployment"],
        primaryActionLabel: "Review changes",
        audience: "admin",
      },
      {
        href: "/superadmin/system-health",
        label: "System Health",
        short: "SH",
        description: "Review infrastructure probes, core table checks, and platform readiness.",
        keywords: ["health", "system", "diagnostics", "database", "infrastructure", "platform"],
        primaryActionLabel: "Review health",
        audience: "admin",
      },
      {
        href: "/superadmin/cyber-security",
        label: "Cyber Security",
        short: "CS",
        description: "Monitor website security headers, audit telemetry, and cyber compliance evidence.",
        keywords: ["cyber", "security", "compliance", "website", "headers", "audit", "monitor"],
        primaryActionLabel: "Open monitor",
        audience: "admin",
      },
      {
        href: "/superadmin/system-test",
        label: "System Test",
        short: "SY",
        description: "Run guided platform checks across auth, routes, APIs, and core workflows.",
        keywords: ["test", "qa", "smoke", "auth", "routes", "apis"],
        primaryActionLabel: "Run tests",
        audience: "admin",
      },
      {
        href: "/superadmin/help-tickets",
        label: "Help Tickets",
        short: "HT",
        description: "Review platform issue tickets submitted by users and track superadmin follow-up.",
        keywords: ["help", "support", "tickets", "issues", "queue", "platform"],
        primaryActionLabel: "Open queue",
        audience: "admin",
      },
    ],
  },
  {
    title: "AI & Predictions",
    description: "AI operations, prediction validation, and injury forecasting tools.",
    audience: "admin",
    items: [
      {
        href: "/superadmin/ai-engine",
        label: "AI Engine Operations",
        short: "AI",
        description: "Inspect AI calls, feedback, evaluations, and operating recommendations.",
        keywords: ["ai", "engine", "llm", "feedback", "evals", "calls", "recommendations"],
        primaryActionLabel: "Open AI operations",
        audience: "admin",
      },
      {
        href: "/superadmin/ai-improvements",
        label: "AI Improvements",
        short: "AP",
        description: "Review AI-assisted improvement requests, pull requests, risk, test evidence, and Super Admin approvals.",
        keywords: ["ai", "improvements", "approval", "codex", "pull request", "risk", "superadmin"],
        primaryActionLabel: "Review approvals",
        audience: "admin",
      },
      {
        href: "/superadmin/prediction-validation",
        label: "Prediction Validation",
        short: "PV",
        description: "Review prediction training records and approve or reject model inputs.",
        keywords: ["prediction", "validation", "model", "training", "review", "forecast"],
        primaryActionLabel: "Validate records",
        audience: "admin",
      },
      {
        href: "/superadmin/injury-weather",
        label: "Injury Weather",
        short: "IW",
        description: "Inspect injury weather diagnostics, source scope, forecasts, and backtests.",
        keywords: ["injury", "weather", "forecast", "backtest", "predictability", "osha"],
        primaryActionLabel: "Open forecasts",
        audience: "admin",
      },
    ],
  },
  {
    title: "Builders & Content",
    description: "Document generator text, program blocks, and jurisdiction standards.",
    audience: "admin",
    items: [
      {
        href: "/superadmin/builder-text",
        label: "Builder Text",
        short: "BT",
        description: "Edit default builder text for CSEP and site safety document sections.",
        keywords: ["builder", "text", "csep", "site safety", "security", "cyber", "documents"],
        primaryActionLabel: "Edit text",
        audience: "admin",
      },
      {
        href: "/superadmin/csep-programs",
        label: "CSEP Program Settings",
        short: "CP",
        description: "Manage reusable CSEP program blocks, controls, training, and references.",
        keywords: ["csep", "program", "controls", "training", "osha", "security", "cyber"],
        primaryActionLabel: "Edit programs",
        audience: "admin",
      },
      {
        href: "/superadmin/jurisdiction-standards",
        label: "Jurisdiction Standards",
        short: "JS",
        description: "Configure jurisdiction-specific standards used by generated safety content.",
        keywords: ["jurisdiction", "standards", "state", "local", "osha", "compliance"],
        primaryActionLabel: "Edit standards",
        audience: "admin",
      },
      {
        href: "/superadmin/document-library",
        label: "Paid Document Library",
        short: "DL",
        description: "Upload global paid documents and manage direct-buy marketplace pricing.",
        keywords: ["document", "library", "marketplace", "paid", "pricing", "upload"],
        primaryActionLabel: "Manage library",
        audience: "admin",
      },
    ],
  },
  {
    title: "Compliance & Review",
    description: "OSHA tracking, survey tests, and completed CSEP review tools.",
    audience: "admin",
    items: [
      {
        href: "/superadmin/osha-ipa-lab",
        label: "Compliance Tracker",
        short: "OA",
        description: "Open the OSHA IPA compliance tracker and workbook-powered lab.",
        keywords: ["osha", "ipa", "compliance", "tracker", "baseline", "lab"],
        primaryActionLabel: "Open tracker",
        audience: "admin",
      },
      {
        href: "/superadmin/csep-survey-test",
        label: "Survey Test CSEP",
        short: "ST",
        description: "Run the superadmin survey test builder and trial CSEP export flow.",
        keywords: ["survey", "test", "csep", "export", "builder", "document"],
        primaryActionLabel: "Run survey test",
        audience: "admin",
      },
      {
        href: "/superadmin/csep-completeness-review",
        label: "CSEP Completeness Review",
        short: "CR",
        description: "Upload a completed CSEP and review missing items or rebuild notes.",
        keywords: ["csep", "review", "completeness", "missing", "rebuild", "quality"],
        primaryActionLabel: "Review CSEP",
        audience: "admin",
      },
    ],
  },
];

export const superadminMostUsedHrefs = [
  "/superadmin/health",
  "/superadmin/system-health",
  "/superadmin/help-tickets",
  "/superadmin/cyber-security",
  "/superadmin/ai-engine",
  "/superadmin/builder-text",
] as const;

export function flattenSuperadminTools() {
  return superadminToolGroups.flatMap((group) => group.items);
}

export function getSuperadminMostUsedTools() {
  const tools = flattenSuperadminTools();
  return superadminMostUsedHrefs
    .map((href) => tools.find((tool) => tool.href === href))
    .filter((tool): tool is SuperadminNavItem => Boolean(tool));
}
