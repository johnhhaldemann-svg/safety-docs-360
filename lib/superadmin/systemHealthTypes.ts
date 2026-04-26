export type SystemHealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type SystemHealthCheck = {
  name: string;
  status: SystemHealthStatus;
  message: string;
  recommendedFix: string | null;
  /** When set (e.g. platform grid), shown as the per-item last check time. */
  lastCheckedAt?: string | null;
};

export type SystemHealthSection = {
  id: string;
  title: string;
  status: SystemHealthStatus;
  score: number;
  lastSuccessfulCheck: string | null;
  recordsChecked: number;
  failedChecks: number;
  message: string;
  recommendedFix: string | null;
  checks: SystemHealthCheck[];
};

export type SystemHealthConnection = {
  from: string;
  to: string;
  status: SystemHealthStatus;
  label: string;
};

export type SystemHealthResponse = {
  overallStatus: SystemHealthStatus;
  healthScore: number;
  lastCheckedAt: string;
  summary: {
    totalChecks: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  /** Canonical infrastructure + core table probes (flat list for the Superadmin grid). */
  platformInfrastructure: SystemHealthCheck[];
  sections: SystemHealthSection[];
  connections: SystemHealthConnection[];
};
