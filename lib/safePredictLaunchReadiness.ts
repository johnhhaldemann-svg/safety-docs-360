export type SafePredictModuleKey =
  | "daps"
  | "permits"
  | "incidents"
  | "observations"
  | "inspections"
  | "hazards"
  | "training"
  | "reports"
  | "jobsites"
  | "users"
  | "actions"
  | "analytics";

export type SafePredictModuleSummary = {
  key: SafePredictModuleKey;
  label: string;
  total: number;
  open: number;
  inProgress: number;
  closed: number;
};

export type SafePredictLaunchMode = "loading" | "live" | "demo";

export type SafePredictLaunchHealth = "ready" | "attention" | "needs-data";

export type SafePredictLaunchSummary = {
  mode: SafePredictLaunchMode;
  companyName: string;
  activeJobsites: number;
  activeUsers: number;
  openWorkItems: number;
  connectedRecords: number;
  health: SafePredictLaunchHealth;
};

const moduleRoutes: Record<SafePredictModuleKey, string> = {
  daps: "/command-center",
  permits: "/permits",
  incidents: "/incidents",
  observations: "/safety-submit",
  inspections: "/field-audits",
  hazards: "/safety-intelligence",
  training: "/training-matrix",
  reports: "/reports",
  jobsites: "/jobsites",
  users: "/company-users",
  actions: "/field-id-exchange",
  analytics: "/analytics",
};

export function safePredictModuleRoute(key: SafePredictModuleKey) {
  return moduleRoutes[key];
}

export function safePredictModuleHealth(module: SafePredictModuleSummary): SafePredictLaunchHealth {
  if (module.total <= 0) return "needs-data";
  if (module.open + module.inProgress > 0) return "attention";
  return "ready";
}

export function summarizeSafePredictLaunch(input: {
  loading: boolean;
  companyName?: string | null;
  hasLiveCompanyProfile: boolean;
  moduleSummaries: SafePredictModuleSummary[];
  activeJobsites: number;
  activeUsers: number;
  demoCompanyName: string;
}): SafePredictLaunchSummary {
  const connectedRecords = input.moduleSummaries.reduce(
    (sum, module) => sum + module.total,
    input.activeJobsites + input.activeUsers
  );
  const openWorkItems = input.moduleSummaries.reduce(
    (sum, module) => sum + module.open + module.inProgress,
    0
  );
  const modulesNeedingData = input.moduleSummaries.filter(
    (module) => safePredictModuleHealth(module) === "needs-data"
  ).length;

  return {
    mode: input.loading ? "loading" : input.hasLiveCompanyProfile ? "live" : "demo",
    companyName:
      input.companyName?.trim() ||
      (input.hasLiveCompanyProfile ? "Company Workspace" : input.demoCompanyName),
    activeJobsites: input.activeJobsites,
    activeUsers: input.activeUsers,
    openWorkItems,
    connectedRecords,
    health:
      input.loading || modulesNeedingData > 1
        ? "needs-data"
        : openWorkItems > 0
          ? "attention"
          : "ready",
  };
}
