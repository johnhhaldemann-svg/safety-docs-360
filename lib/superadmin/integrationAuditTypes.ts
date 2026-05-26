import type { SystemHealthStatus } from "@/lib/superadmin/systemHealthTypes";

export type IntegrationAuditStatus = SystemHealthStatus;

export type IntegrationAuditNodeId =
  | "vercel_deployment"
  | "next_runtime"
  | "supabase_project"
  | "auth_rbac"
  | "storage_documents"
  | "core_workflows"
  | "scheduled_jobs"
  | "safety_ai";

export type IntegrationAuditCategory =
  | "vercel"
  | "supabase"
  | "auth"
  | "storage"
  | "workflow"
  | "cron"
  | "ai"
  | "security";

export type IntegrationAuditCheck = {
  id: string;
  nodeId: IntegrationAuditNodeId;
  category: IntegrationAuditCategory;
  label: string;
  status: IntegrationAuditStatus;
  message: string;
  evidence: string[];
  recommendedAction: string | null;
  lastCheckedAt: string;
};

export type IntegrationAuditNode = {
  id: IntegrationAuditNodeId;
  label: string;
  status: IntegrationAuditStatus;
  message: string;
  checkIds: string[];
};

export type IntegrationAuditEdge = {
  from: IntegrationAuditNodeId;
  to: IntegrationAuditNodeId;
  status: IntegrationAuditStatus;
  label: string;
  checkIds: string[];
};

export type IntegrationAuditSummary = {
  totalChecks: number;
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
};

export type IntegrationAuditResponse = {
  generatedAt: string;
  sourceOfTruth: "production";
  project: {
    supabaseRef: string | null;
    vercelProjectId: string | null;
    vercelProjectName: string | null;
    vercelOrgId: string | null;
    latestLocalMigration: string | null;
    latestRemoteMigration: string | null;
  };
  summary: IntegrationAuditSummary;
  nodes: IntegrationAuditNode[];
  edges: IntegrationAuditEdge[];
  checks: IntegrationAuditCheck[];
  topIssues: IntegrationAuditCheck[];
};
