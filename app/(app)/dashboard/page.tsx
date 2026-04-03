"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  SectionCard,
  StartChecklist,
  StatusBadge,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { CompanyAdminDashboard } from "@/app/(app)/dashboard/company-admin-dashboard";
import type {
  CompanyJobsite,
  LiveMatrixRow,
  ModuleSummaryItem,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import { getPermissionMap, isCompanyAdminRole, type PermissionMap } from "@/lib/rbac";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";
import {
  getDocumentStatusLabel,
  isApprovedDocumentStatus,
  isArchivedDocumentStatus,
  isSubmittedDocumentStatus,
} from "@/lib/documentStatus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentRow = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_title?: string | null;
  document_type: string | null;
  category?: string | null;
  status: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
  file_name?: string | null;
};

type CountCard = {
  title: string;
  value: string;
  note: string;
  trend: string;
  icon: "projects" | "review" | "approved" | "records";
};

type WorkspaceCard = {
  title: string;
  value: string;
  description: string;
  href: string;
};

type ActionCard = {
  title: string;
  description: string;
  href: string;
  button: string;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

type CompanyProfile = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
};

type CompanyJobsiteRow = {
  id: string;
  company_id: string;
  name: string;
  project_number: string | null;
  location: string | null;
  status: string | null;
  project_manager: string | null;
  safety_lead: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at?: string | null;
};

type CorrectiveActionSummaryRow = {
  category?: string | null;
  status?: string | null;
  due_at?: string | null;
};

type HighRiskAlert = {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "info";
};

type CompanyDashboardMetrics = {
  totalActiveJobsites: number;
  totalOpenObservations: number;
  totalHighRiskObservations: number;
  sifCount: number;
  averageClosureTimeHours: number;
  topHazardCategories: Array<{ category: string; count: number }>;
  openIncidents: number;
  dapCompletionToday: { completed: number; total: number; percent: number };
};

type CompanyAnalyticsSummaryPayload = {
  summary?: { companyDashboard?: CompanyDashboardMetrics };
  error?: string;
  warning?: string;
} | null;

function applyCompanyAnalyticsDashboardState(
  setCompanyDashboardMetrics: (value: CompanyDashboardMetrics | null) => void,
  setAnalyticsSummaryIssue: (
    value: { message: string; tone: "error" | "warning" } | null
  ) => void,
  analyticsResponse: Response,
  analyticsData: CompanyAnalyticsSummaryPayload
) {
  const ok = analyticsResponse.ok;

  if (!ok) {
    setCompanyDashboardMetrics(null);
    const err = typeof analyticsData?.error === "string" ? analyticsData.error.trim() : "";
    const warn = typeof analyticsData?.warning === "string" ? analyticsData.warning.trim() : "";
    setAnalyticsSummaryIssue({
      message: err || warn || "Company analytics summary could not be loaded.",
      tone: err ? "error" : "warning",
    });
    return;
  }

  const dash = analyticsData?.summary?.companyDashboard ?? null;
  setCompanyDashboardMetrics(dash);
  const err = typeof analyticsData?.error === "string" ? analyticsData.error.trim() : "";
  const warn = typeof analyticsData?.warning === "string" ? analyticsData.warning.trim() : "";
  if (dash != null) {
    setAnalyticsSummaryIssue(null);
  } else {
    setAnalyticsSummaryIssue({
      message:
        err ||
        warn ||
        "Company analytics summary is not available. Your account may not be linked to a company workspace yet.",
      tone: err ? "error" : "warning",
    });
  }
}

function isApprovedDocument(document: DocumentRow) {
  return isApprovedDocumentStatus(document.status, Boolean(document.final_file_path));
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Updated recently";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getDocumentLabel(document: DocumentRow) {
  return (
    document.document_title ??
    document.project_name ??
    document.file_name ??
    "Untitled document"
  );
}

function getStatusLabel(document: DocumentRow) {
  return getDocumentStatusLabel(document.status, Boolean(document.final_file_path));
}

function normalizeType(documentType?: string | null) {
  return (documentType ?? "").trim().toLowerCase();
}

function normalizeCompanyJobsiteStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "planned") return "planned" as const;
  if (normalized === "completed") return "completed" as const;
  if (normalized === "archived") return "archived" as const;
  return "active" as const;
}

function getStatusTone(label: string): "neutral" | "success" | "warning" | "info" {
  if (label === "Ready" || label === "Active" || label === "Searchable" || label === "Clear") {
    return "success";
  }

  if (label === "Waiting" || label === "Needs attention" || label === "No records") {
    return "warning";
  }

  return "info";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function syntheticJsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Never throws: failed/timeout fetches become non-OK JSON responses so callers can still merge partial workspace state. */
async function fetchWithTimeoutSafe(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  errorPrefix: string
): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init, timeoutMs);
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return syntheticJsonResponse(
      {
        error: timedOut ? `${errorPrefix} timed out.` : `${errorPrefix} could not be reached.`,
      },
      503
    );
  }
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceTime] = useState(() => Date.now());
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("viewer");
  const [userTeam, setUserTeam] = useState("General");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [companyInvites, setCompanyInvites] = useState<CompanyInvite[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyJobsiteRows, setCompanyJobsiteRows] = useState<CompanyJobsiteRow[]>([]);
  const [liveMatrixSummary, setLiveMatrixSummary] = useState<LiveMatrixRow[]>([]);
  const [moduleSummaries, setModuleSummaries] = useState<ModuleSummaryItem[]>([]);
  const [highRiskAlerts, setHighRiskAlerts] = useState<HighRiskAlert[]>([]);
  const [companyDashboardMetrics, setCompanyDashboardMetrics] = useState<CompanyDashboardMetrics | null>(null);
  const [analyticsSummaryIssue, setAnalyticsSummaryIssue] = useState<{
    message: string;
    tone: "error" | "warning";
  } | null>(null);
  const [companyWorkspaceLoaded, setCompanyWorkspaceLoaded] = useState(false);
  const [companyWorkspaceLoading, setCompanyWorkspaceLoading] = useState(false);
  const [companyWorkspaceError, setCompanyWorkspaceError] = useState<string | null>(null);
  const [workspaceProduct, setWorkspaceProduct] = useState<WorkspaceProduct>("full");

  useEffect(() => {
    void (async () => {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;

      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const authHeaders = { Authorization: `Bearer ${accessToken}` };
        const meResponse = await fetchWithTimeout("/api/auth/me", { headers: authHeaders }, 15000);
        const meData = (await meResponse.json().catch(() => null)) as
          | {
              user?: {
                role?: string;
                team?: string;
                companyId?: string | null;
                permissionMap?: PermissionMap;
                companyProfile?: CompanyProfile | null;
                workspaceProduct?: WorkspaceProduct;
              };
            }
          | null;

        const nextWorkspaceProduct: WorkspaceProduct =
          meData?.user?.workspaceProduct === "csep" ? "csep" : "full";

        if (meResponse.ok) {
          setUserRole(meData?.user?.role ?? "viewer");
          setUserTeam(meData?.user?.team ?? "General");
          setPermissionMap(meData?.user?.permissionMap ?? null);
          setCompanyProfile(meData?.user?.companyProfile ?? null);
          setWorkspaceProduct(nextWorkspaceProduct);
        }

        const isCompanyAdmin = isCompanyAdminRole(meData?.user?.role);
        if (isCompanyAdmin && nextWorkspaceProduct === "csep") {
          const [documentsResponse, creditResponse] = await Promise.all([
            fetchWithTimeout("/api/workspace/documents", { headers: authHeaders }, 15000),
            fetchWithTimeout("/api/library/credits", { headers: authHeaders }, 15000),
          ]);
          const documentsData = (await documentsResponse.json().catch(() => null)) as
            | { documents?: DocumentRow[] }
            | null;
          const creditData = (await creditResponse.json().catch(() => null)) as
            | { creditBalance?: number }
            | null;
          if (documentsResponse.ok) {
            setDocuments(documentsData?.documents ?? []);
          }
          if (creditResponse.ok) {
            setCreditBalance(Number(creditData?.creditBalance ?? 0));
          }
          setCompanyWorkspaceLoaded(true);
          setLoading(false);
          return;
        }

        const [documentsResponse, creditResponse] = await Promise.all([
          fetchWithTimeout("/api/workspace/documents", { headers: authHeaders }, 15000),
          fetchWithTimeout("/api/library/credits", { headers: authHeaders }, 15000),
        ]);

        const documentsData = (await documentsResponse.json().catch(() => null)) as
          | { documents?: DocumentRow[] }
          | null;

        if (documentsResponse.ok) {
          setDocuments(documentsData?.documents ?? []);
        }

        const creditData = (await creditResponse.json().catch(() => null)) as
          | { creditBalance?: number }
          | null;

        if (creditResponse.ok) {
          setCreditBalance(Number(creditData?.creditBalance ?? 0));
        }

        const perm: PermissionMap =
          meData?.user?.permissionMap ?? getPermissionMap(meData?.user?.role);
        const canLoadCompanyWorkspace =
          nextWorkspaceProduct !== "csep" &&
          Boolean(
            perm.can_manage_company_users ||
              perm.can_manage_users ||
              perm.can_view_analytics ||
              perm.can_view_all_company_data ||
              perm.can_view_dashboards
          );

        setLoading(false);

        if (canLoadCompanyWorkspace) {
          const [companyResponse, workspaceSummaryResponse, analyticsResponse] = await Promise.all([
            fetchWithTimeoutSafe("/api/company/users", { headers: authHeaders }, 15000, "Company directory"),
            fetchWithTimeoutSafe("/api/company/workspace/summary", { headers: authHeaders }, 15000, "Workspace summary"),
            fetchWithTimeoutSafe("/api/company/analytics/summary?days=30", { headers: authHeaders }, 15000, "Analytics summary"),
          ]);

          const companyData = (await companyResponse.json().catch(() => null)) as {
            users?: CompanyUser[];
            invites?: CompanyInvite[];
          } | null;
          const workspaceSummaryData = (await workspaceSummaryResponse.json().catch(() => null)) as {
            jobsites?: CompanyJobsiteRow[];
            observations?: CorrectiveActionSummaryRow[];
            daps?: Array<{ status?: string | null }>;
            permits?: Array<{
              id?: string;
              title?: string | null;
              status?: string | null;
              severity?: string | null;
              sif_flag?: boolean | null;
              escalation_level?: string | null;
              stop_work_status?: string | null;
            }>;
            incidents?: Array<{
              id?: string;
              title?: string | null;
              status?: string | null;
              severity?: string | null;
              sif_flag?: boolean | null;
              escalation_level?: string | null;
              stop_work_status?: string | null;
            }>;
            reports?: Array<{ status?: string | null }>;
          } | null;
          const analyticsData = (await analyticsResponse.json().catch(() => null)) as CompanyAnalyticsSummaryPayload;

          if (companyResponse.ok) {
            setCompanyUsers(companyData?.users ?? []);
            setCompanyInvites(companyData?.invites ?? []);
          }
          if (workspaceSummaryResponse.ok) {
            setCompanyJobsiteRows(workspaceSummaryData?.jobsites ?? []);
          }

          const correctiveActions = workspaceSummaryResponse.ok
            ? workspaceSummaryData?.observations ?? []
            : [];
          const daps = workspaceSummaryResponse.ok ? workspaceSummaryData?.daps ?? [] : [];
          const permits = workspaceSummaryResponse.ok ? workspaceSummaryData?.permits ?? [] : [];
          const incidents = workspaceSummaryResponse.ok ? workspaceSummaryData?.incidents ?? [] : [];
          const reports = workspaceSummaryResponse.ok ? workspaceSummaryData?.reports ?? [] : [];
          const rows = new Map<string, LiveMatrixRow>();
          for (const action of correctiveActions) {
            const category = (action.category ?? "corrective_action").trim().toLowerCase();
            const status = (action.status ?? "open").trim().toLowerCase();
            const row =
              rows.get(category) ?? { category, open: 0, inProgress: 0, closed: 0, overdue: 0 };
            if (status === "closed") row.closed += 1;
            else if (status === "in_progress") row.inProgress += 1;
            else row.open += 1;
            if (status !== "closed" && action.due_at) {
              const due = new Date(action.due_at).getTime();
              if (!Number.isNaN(due) && due < Date.now()) row.overdue += 1;
            }
            rows.set(category, row);
          }
          setLiveMatrixSummary(
            Array.from(rows.values()).sort((a, b) => a.category.localeCompare(b.category))
          );

          const summarize = (
            key: ModuleSummaryItem["key"],
            label: string,
            items: Array<{ status?: string | null }>
          ): ModuleSummaryItem => {
            let open = 0;
            let inProgress = 0;
            let closed = 0;
            for (const item of items) {
              const status = (item.status ?? "").trim().toLowerCase();
              if (status === "closed" || status === "archived" || status === "published" || status === "expired") closed += 1;
              else if (status === "in_progress" || status === "active") inProgress += 1;
              else open += 1;
            }
            return { key, label, total: items.length, open, inProgress, closed };
          };
          setModuleSummaries([
            summarize("daps", "JSAs", daps),
            summarize("permits", "Permits", permits),
            summarize("incidents", "Incidents", incidents),
            summarize("reports", "Reports", reports),
          ]);

          const alerts: HighRiskAlert[] = [];
          for (const permit of permits) {
            if (permit.stop_work_status === "stop_work_active") {
              alerts.push({
                id: `permit-stop-${permit.id ?? Math.random()}`,
                title: permit.title || "Permit with active stop-work",
                detail: "Stop-work is active and requires leadership clearance.",
                tone: "warning",
              });
            } else if (permit.escalation_level === "critical" || permit.sif_flag) {
              alerts.push({
                id: `permit-risk-${permit.id ?? Math.random()}`,
                title: permit.title || "Permit escalated",
                detail: "Critical/SIF permit requires immediate operations review.",
                tone: "warning",
              });
            }
          }
          for (const incident of incidents) {
            if (incident.stop_work_status === "stop_work_active") {
              alerts.push({
                id: `incident-stop-${incident.id ?? Math.random()}`,
                title: incident.title || "Incident with active stop-work",
                detail: "Incident triggered stop-work and must be resolved before restart.",
                tone: "warning",
              });
            } else if (incident.escalation_level === "critical" || incident.sif_flag) {
              alerts.push({
                id: `incident-risk-${incident.id ?? Math.random()}`,
                title: incident.title || "Incident escalated",
                detail: "Critical/SIF incident is in high-risk review.",
                tone: "warning",
              });
            }
          }
          setHighRiskAlerts(alerts.slice(0, 8));
          applyCompanyAnalyticsDashboardState(
            setCompanyDashboardMetrics,
            setAnalyticsSummaryIssue,
            analyticsResponse,
            analyticsData
          );

          setCompanyWorkspaceLoaded(true);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn("Dashboard load timed out – showing partial data.");
        } else {
          console.error("Dashboard load error:", error);
        }
        setLoading(false);
      }
    })();
  }, []);

  async function loadCompanyWorkspace() {
    setCompanyWorkspaceLoading(true);
    setCompanyWorkspaceError(null);

    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;

      if (!accessToken) {
        setCompanyWorkspaceError("Sign in again to load the company workspace.");
        return;
      }

      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      if (workspaceProduct === "csep") {
        const [documentsResponse, creditResponse] = await Promise.all([
          fetch("/api/workspace/documents", { headers: authHeaders }),
          fetch("/api/library/credits", { headers: authHeaders }),
        ]);
        const documentsData = (await documentsResponse.json().catch(() => null)) as
          | { documents?: DocumentRow[] }
          | null;
        const creditData = (await creditResponse.json().catch(() => null)) as
          | { creditBalance?: number }
          | null;
        if (documentsResponse.ok) {
          setDocuments(documentsData?.documents ?? []);
        }
        if (creditResponse.ok) {
          setCreditBalance(Number(creditData?.creditBalance ?? 0));
        }
        setAnalyticsSummaryIssue(null);
        setCompanyWorkspaceLoaded(true);
      } else {
      const [documentsResponse, creditResponse, companyResponse, workspaceSummaryResponse, analyticsResponse] =
        await Promise.all([
          fetchWithTimeoutSafe("/api/workspace/documents", { headers: authHeaders }, 15000, "Documents"),
          fetchWithTimeoutSafe("/api/library/credits", { headers: authHeaders }, 15000, "Credits"),
          fetchWithTimeoutSafe("/api/company/users", { headers: authHeaders }, 15000, "Company directory"),
          fetchWithTimeoutSafe("/api/company/workspace/summary", { headers: authHeaders }, 15000, "Workspace summary"),
          fetchWithTimeoutSafe("/api/company/analytics/summary?days=30", { headers: authHeaders }, 15000, "Analytics summary"),
        ]);

      const documentsData = (await documentsResponse.json().catch(() => null)) as
        | { documents?: DocumentRow[] }
        | null;
      const creditData = (await creditResponse.json().catch(() => null)) as
        | { creditBalance?: number }
        | null;
      const companyData = (await companyResponse.json().catch(() => null)) as
        | { users?: CompanyUser[]; invites?: CompanyInvite[] }
        | null;
      const workspaceSummaryData = (await workspaceSummaryResponse.json().catch(() => null)) as {
        jobsites?: CompanyJobsiteRow[];
        observations?: CorrectiveActionSummaryRow[];
        daps?: Array<{ status?: string | null }>;
        permits?: Array<{
          id?: string;
          title?: string | null;
          status?: string | null;
          severity?: string | null;
          sif_flag?: boolean | null;
          escalation_level?: string | null;
          stop_work_status?: string | null;
        }>;
        incidents?: Array<{
          id?: string;
          title?: string | null;
          status?: string | null;
          severity?: string | null;
          sif_flag?: boolean | null;
          escalation_level?: string | null;
          stop_work_status?: string | null;
        }>;
        reports?: Array<{ status?: string | null }>;
      } | null;
      const analyticsData = (await analyticsResponse.json().catch(() => null)) as CompanyAnalyticsSummaryPayload;

      if (documentsResponse.ok) {
        setDocuments(documentsData?.documents ?? []);
      }
      if (creditResponse.ok) {
        setCreditBalance(Number(creditData?.creditBalance ?? 0));
      }
      if (companyResponse.ok) {
        setCompanyUsers(companyData?.users ?? []);
        setCompanyInvites(companyData?.invites ?? []);
      }
      if (workspaceSummaryResponse.ok) {
        setCompanyJobsiteRows(workspaceSummaryData?.jobsites ?? []);
      }

      const correctiveActions = workspaceSummaryResponse.ok
        ? workspaceSummaryData?.observations ?? []
        : [];
      const daps = workspaceSummaryResponse.ok ? workspaceSummaryData?.daps ?? [] : [];
      const permits = workspaceSummaryResponse.ok ? workspaceSummaryData?.permits ?? [] : [];
      const incidents = workspaceSummaryResponse.ok ? workspaceSummaryData?.incidents ?? [] : [];
      const reports = workspaceSummaryResponse.ok ? workspaceSummaryData?.reports ?? [] : [];
      const rows = new Map<string, LiveMatrixRow>();
      for (const action of correctiveActions) {
        const category = (action.category ?? "corrective_action").trim().toLowerCase();
        const status = (action.status ?? "open").trim().toLowerCase();
        const row = rows.get(category) ?? { category, open: 0, inProgress: 0, closed: 0, overdue: 0 };
        if (status === "closed") row.closed += 1;
        else if (status === "in_progress") row.inProgress += 1;
        else row.open += 1;
        if (status !== "closed" && action.due_at) {
          const due = new Date(action.due_at).getTime();
          if (!Number.isNaN(due) && due < Date.now()) row.overdue += 1;
        }
        rows.set(category, row);
      }
      setLiveMatrixSummary(Array.from(rows.values()).sort((a, b) => a.category.localeCompare(b.category)));

      const summarize = (
        key: ModuleSummaryItem["key"],
        label: string,
        items: Array<{ status?: string | null }>
      ): ModuleSummaryItem => {
        let open = 0;
        let inProgress = 0;
        let closed = 0;
        for (const item of items) {
          const status = (item.status ?? "").trim().toLowerCase();
          if (status === "closed" || status === "archived" || status === "published" || status === "expired") closed += 1;
          else if (status === "in_progress" || status === "active") inProgress += 1;
          else open += 1;
        }
        return { key, label, total: items.length, open, inProgress, closed };
      };
      setModuleSummaries([
        summarize("daps", "JSAs", daps),
        summarize("permits", "Permits", permits),
        summarize("incidents", "Incidents", incidents),
        summarize("reports", "Reports", reports),
      ]);

      const alerts: HighRiskAlert[] = [];
      for (const permit of permits) {
        if (permit.stop_work_status === "stop_work_active") {
          alerts.push({
            id: `permit-stop-${permit.id ?? Math.random()}`,
            title: permit.title || "Permit with active stop-work",
            detail: "Stop-work is active and requires leadership clearance.",
            tone: "warning",
          });
        } else if (permit.escalation_level === "critical" || permit.sif_flag) {
          alerts.push({
            id: `permit-risk-${permit.id ?? Math.random()}`,
            title: permit.title || "Permit escalated",
            detail: "Critical/SIF permit requires immediate operations review.",
            tone: "warning",
          });
        }
      }
      for (const incident of incidents) {
        if (incident.stop_work_status === "stop_work_active") {
          alerts.push({
            id: `incident-stop-${incident.id ?? Math.random()}`,
            title: incident.title || "Incident with active stop-work",
            detail: "Incident triggered stop-work and must be resolved before restart.",
            tone: "warning",
          });
        } else if (incident.escalation_level === "critical" || incident.sif_flag) {
          alerts.push({
            id: `incident-risk-${incident.id ?? Math.random()}`,
            title: incident.title || "Incident escalated",
            detail: "Critical/SIF incident is in high-risk review.",
            tone: "warning",
          });
        }
      }
      setHighRiskAlerts(alerts.slice(0, 8));
      applyCompanyAnalyticsDashboardState(
        setCompanyDashboardMetrics,
        setAnalyticsSummaryIssue,
        analyticsResponse,
        analyticsData
      );

      setCompanyWorkspaceLoaded(true);
      }
    } catch (error) {
      console.error("Company workspace load error:", error);
      setCompanyWorkspaceError("Unable to load the company workspace right now. Please try Refresh Workspace again.");
    } finally {
      setCompanyWorkspaceLoading(false);
    }
  }

  const isCompanyAdminDashboard = userRole === "company_admin";
  const isManagerView =
    userRole === "company_admin" ||
    userRole === "manager" ||
    userRole === "company_user";
  const canManageCompanyUsers = Boolean(permissionMap?.can_manage_company_users);
  const companyManagementHref = canManageCompanyUsers ? "/company-users" : "/library";

  const activeDocuments = useMemo(
    () => documents.filter((document) => !isArchivedDocumentStatus(document.status)),
    [documents]
  );

  const companyJobsites = useMemo<CompanyJobsite[]>(() => {
    const grouped = new Map<
      string,
      {
        name: string;
        location: string;
        lastActivity: string | null;
        totalDocuments: number;
        pendingDocuments: number;
      }
    >();

    for (const document of activeDocuments) {
      const name = document.project_name?.trim() || "General Workspace";
      const key = name.toLowerCase();
      const existing = grouped.get(key) ?? {
        name,
        location:
          [companyProfile?.city?.trim(), companyProfile?.state_region?.trim()]
            .filter(Boolean)
            .join(", ") || "Location not set",
        lastActivity: null,
        totalDocuments: 0,
        pendingDocuments: 0,
      };

      existing.totalDocuments += 1;
      if (isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))) {
        existing.pendingDocuments += 1;
      }
      if (
        !existing.lastActivity ||
        new Date(document.created_at).getTime() > new Date(existing.lastActivity).getTime()
      ) {
        existing.lastActivity = document.created_at;
      }

      grouped.set(key, existing);
    }

    const merged = new Map<string, CompanyJobsite>();

    for (const row of companyJobsiteRows) {
      const key = row.name.trim().toLowerCase();
      const documentGroup = grouped.get(key);
      const rawStatus = normalizeCompanyJobsiteStatus(row.status);
      const status =
        rawStatus === "archived"
          ? ("Archived" as const)
          : rawStatus === "completed"
            ? ("Completed" as const)
            : documentGroup?.pendingDocuments
              ? ("Action needed" as const)
              : rawStatus === "planned"
                ? ("Planned" as const)
                : ("Active" as const);

      merged.set(key, {
        id: row.id,
        name: row.name,
        location:
          row.location?.trim() ||
          documentGroup?.location ||
          [companyProfile?.city?.trim(), companyProfile?.state_region?.trim()]
            .filter(Boolean)
            .join(", ") ||
          "Location not set",
        lastActivity: documentGroup?.lastActivity ?? row.updated_at ?? row.created_at ?? null,
        totalDocuments: documentGroup?.totalDocuments ?? 0,
        pendingDocuments: documentGroup?.pendingDocuments ?? 0,
        projectNumber: row.project_number?.trim() || "",
        status,
        rawStatus,
        projectManager: row.project_manager,
        safetyLead: row.safety_lead,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        source: "table",
      });
    }

    for (const documentGroup of grouped.values()) {
      const key = documentGroup.name.toLowerCase();
      if (merged.has(key)) continue;

      merged.set(key, {
        id: `fallback-${key.replace(/[^a-z0-9]+/g, "-") || "general"}`,
        name: documentGroup.name,
        location: documentGroup.location,
        lastActivity: documentGroup.lastActivity,
        totalDocuments: documentGroup.totalDocuments,
        pendingDocuments: documentGroup.pendingDocuments,
        projectNumber: "",
        status:
          documentGroup.pendingDocuments > 0
            ? "Action needed"
            : documentGroup.lastActivity &&
                referenceTime - new Date(documentGroup.lastActivity).getTime() <=
                  1000 * 60 * 60 * 24 * 21
              ? "Active"
              : "Completed",
        rawStatus:
          documentGroup.pendingDocuments > 0
            ? "active"
            : documentGroup.lastActivity &&
                referenceTime - new Date(documentGroup.lastActivity).getTime() <=
                  1000 * 60 * 60 * 24 * 21
              ? "active"
              : "completed",
        projectManager: null,
        safetyLead: null,
        startDate: null,
        endDate: null,
        notes: null,
        createdAt: null,
        updatedAt: null,
        source: "document_fallback",
      });
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        const left = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const right = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return right - left;
      })
      .map((jobsite, index) => ({
        ...jobsite,
        projectNumber:
          jobsite.projectNumber || `SITE-${String(index + 1).padStart(2, "0")}`,
      }));
  }, [
    activeDocuments,
    companyJobsiteRows,
    companyProfile?.city,
    companyProfile?.state_region,
    referenceTime,
  ]);

  const uniqueProjects = useMemo(() => {
    return new Set(
      activeDocuments
        .map((document) => document.project_name?.trim())
        .filter((value): value is string => Boolean(value))
    ).size;
  }, [activeDocuments]);

  const pendingReviewCount = useMemo(
    () =>
      activeDocuments.filter((document) =>
        isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
      ).length,
    [activeDocuments]
  );

  const approvedCount = useMemo(
    () => activeDocuments.filter((document) => isApprovedDocument(document)).length,
    [activeDocuments]
  );

  const companyUserCount = companyUsers.length;
  const pendingCompanyApprovals = useMemo(
    () => companyUsers.filter((user) => user.status === "Pending").length,
    [companyUsers]
  );

  const templateCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "template")
        .length,
    [activeDocuments]
  );

  const formCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "form")
        .length,
    [activeDocuments]
  );

  const reportCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "report")
        .length,
    [activeDocuments]
  );

  const peshepCount = useMemo(
    () =>
      activeDocuments.filter((document) =>
        /(peshep|pshsep)/i.test(document.document_type ?? "")
      ).length,
    [activeDocuments]
  );

  const csepCount = useMemo(
    () =>
      activeDocuments.filter((document) => /csep/i.test(document.document_type ?? "")).length,
    [activeDocuments]
  );

  const countCards: CountCard[] = isManagerView
    ? [
        {
          title: "Completed Docs",
          value: String(approvedCount),
          note: "Completed files currently available to this company account",
          trend: approvedCount > 0 ? "Ready to open" : "No completed docs yet",
          icon: "approved",
        },
        {
          title: "Credits Remaining",
          value: creditBalance === null ? "-" : String(creditBalance),
          note: "Available for unlocking completed marketplace records",
          trend: creditBalance && creditBalance > 0 ? "Ready for unlocks" : "No credits loaded",
          icon: "records",
        },
        ...(canManageCompanyUsers
          ? [
              {
                title: "Company Users",
                value: String(companyUserCount),
                note: `Members currently assigned to ${userTeam}`,
                trend: companyUserCount > 0 ? "Company access is live" : "No company users yet",
                icon: "projects" as const,
              },
              {
                title: "Pending Company Access",
                value: String(pendingCompanyApprovals),
                note: "Users waiting for approval or activation in this company",
                trend: pendingCompanyApprovals > 0 ? "Action needed" : "No pending approvals",
                icon: "review" as const,
              },
            ]
          : [
              {
                title: "Templates",
                value: String(templateCount),
                note: "Completed template records currently visible",
                trend: templateCount > 0 ? "Ready to open" : "No templates visible",
                icon: "records" as const,
              },
              {
                title: "Reports",
                value: String(reportCount),
                note: "Completed report documents available in the library",
                trend: reportCount > 0 ? "Ready to open" : "No reports visible",
                icon: "records" as const,
              },
            ]),
      ]
    : [
        {
          title: "Active Projects",
          value: String(uniqueProjects),
          note: "Unique project names with active records",
          trend: pendingReviewCount > 0 ? `${pendingReviewCount} waiting review` : "No review backlog",
          icon: "projects",
        },
        {
          title: "Pending Review",
          value: String(pendingReviewCount),
          note: "Submitted records waiting for approval",
          trend: pendingReviewCount > 0 ? "Action needed" : "Queue is clear",
          icon: "review",
        },
        {
          title: "Approved Files",
          value: String(approvedCount),
          note: "Completed documents ready for library access",
          trend: approvedCount > 0 ? "Ready to open" : "No completed docs yet",
          icon: "approved",
        },
        {
          title: "Credits Remaining",
          value: creditBalance === null ? "-" : String(creditBalance),
          note: "Available for marketplace document unlocks",
          trend: creditBalance && creditBalance > 0 ? "Ready for unlocks" : "No credits loaded",
          icon: "records",
        },
        {
          title: "Total Records",
          value: String(activeDocuments.length),
          note: "All active uploads, drafts, and completed files",
          trend: `${templateCount + formCount + reportCount} standard docs tracked`,
          icon: "records",
        },
      ];

  const workspaceCards: WorkspaceCard[] = isManagerView
    ? [
        {
          title: "Completed Library Docs",
          value: String(approvedCount),
          description: "Completed documents your company account can open.",
          href: "/library",
        },
        ...(canManageCompanyUsers
          ? [
              {
                title: "Company Users",
                value: String(companyUserCount),
                description: "People currently assigned to your company workspace.",
                href: "/company-users",
              },
              {
                title: "Pending Company Access",
                value: String(pendingCompanyApprovals),
                description: "Users who still need approval or activation.",
                href: "/company-users",
              },
            ]
          : [
              {
                title: "Library Access",
                value: String(approvedCount),
                description: "Approved documents visible to this company role.",
                href: "/library",
              },
              {
                title: "Completed Reports",
                value: String(reportCount),
                description: "Report documents available to open in the company library.",
                href: "/library",
              },
            ]),
        {
          title: "Credits",
          value: creditBalance === null ? "-" : String(creditBalance),
          description: "Available for completed document unlocks.",
          href: "/library",
        },
      ]
    : [
        {
          title: "Ready Library Docs",
          value: String(approvedCount),
          description: "Approved and completed files available in the library.",
          href: "/library",
        },
        {
          title: "Submit Queue",
          value: String(pendingReviewCount),
          description: "Requests and documents currently moving through review.",
          href: "/submit",
        },
        {
          title: "PESHEP Files",
          value: String(peshepCount),
          description: "Project safety and health execution plans in the system.",
          href: "/peshep",
        },
        {
          title: "CSEP Files",
          value: String(csepCount),
          description: "Contractor site-specific safety plans tracked here.",
          href: "/csep",
        },
      ];

  const actionCards: ActionCard[] = isManagerView
    ? [
        {
          title: "Open Completed Library",
          description: "Browse approved and completed documents available to your company account.",
          href: "/library",
          button: "Open Library",
        },
        ...(canManageCompanyUsers
          ? [
              {
                title: "Manage Company Users",
                description: "Invite teammates and keep access limited to your company.",
                href: "/company-users",
                button: "Manage Users",
              },
            ]
          : []),
      ]
    : [
        {
          title: "Start Submission",
          description: "Create a new request and send documents into the review workflow.",
          href: "/submit",
          button: "Open Submit",
        },
        {
          title: "Build PESHEP",
          description: "Launch the PESHEP builder for project safety planning.",
          href: "/peshep",
          button: "Build Plan",
        },
        {
          title: "Build CSEP",
          description: "Create contractor-specific safety documentation and controls.",
          href: "/csep",
          button: "Open CSEP",
        },
        {
          title: "Upload Files",
          description: "Add templates, forms, reports, and supporting documents.",
          href: "/upload",
          button: "Upload Now",
        },
      ];

  const recentActivity = useMemo(() => {
    const items = activeDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail: document.project_name || document.document_type || "Workspace document",
      meta: `${getStatusLabel(document)} - ${formatRelative(document.created_at)}`,
      tone: isApprovedDocument(document)
        ? ("success" as const)
        : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
          ? ("warning" as const)
          : ("info" as const),
    }));

    if (items.length > 0) return items;

    return [
      {
        id: "empty-1",
        title: "No recent document activity yet",
        detail: "Start by uploading or submitting a document.",
        meta: "Waiting",
        tone: "neutral" as const,
      },
    ];
  }, [activeDocuments]);

  const reviewQueueItems = useMemo(() => {
    if (isManagerView) {
      const managerItems = companyUsers
        .filter((user) => user.status === "Pending")
        .slice(0, 4)
        .map((user) => ({
          id: user.id,
          title: "Company user awaiting approval",
          detail: `${user.status} access for ${userTeam}.`,
        }));

      if (managerItems.length > 0) return managerItems;

      return [
        {
          id: "manager-queue-1",
          title: "Company access queue is clear",
          detail: "New company users will appear here when they need action.",
        },
      ];
    }

    const queued = activeDocuments
      .filter((document) =>
        isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
      )
      .slice(0, 4)
      .map((document) => ({
        id: document.id,
        title: getDocumentLabel(document),
        detail: document.project_name || document.document_type || "Submitted document",
      }));

    if (queued.length > 0) return queued;

    return [
      {
        id: "queue-1",
        title: "Review queue is clear",
        detail: "New submissions will appear here for quick follow-up.",
      },
    ];
  }, [activeDocuments, companyUsers, isManagerView, userTeam]);

  const latestUpdates = useMemo(() => {
    if (isManagerView) {
      return [
        {
          id: "update-company-library",
          title:
            approvedCount > 0
              ? `${approvedCount} completed file${approvedCount === 1 ? "" : "s"} ready in your company library`
              : "No completed files are ready yet",
          detail: "Completed documents",
          meta: approvedCount > 0 ? "Ready" : "Waiting",
          tone: approvedCount > 0 ? ("success" as const) : ("warning" as const),
        },
        {
          id: "update-company-users",
          title:
            companyUserCount > 0
              ? `${companyUserCount} user${companyUserCount === 1 ? "" : "s"} assigned to ${userTeam}`
              : "No company users have been added yet",
          detail: "Company access",
          meta: companyUserCount > 0 ? "Live" : "Start here",
          tone: companyUserCount > 0 ? ("info" as const) : ("warning" as const),
        },
        {
          id: "update-company-pending",
          title:
            pendingCompanyApprovals > 0
              ? `${pendingCompanyApprovals} company user${pendingCompanyApprovals === 1 ? "" : "s"} waiting for approval`
              : "No pending company approvals",
          detail: "User approval queue",
          meta: pendingCompanyApprovals > 0 ? "Action needed" : "Clear",
          tone: pendingCompanyApprovals > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          id: "update-company-credits",
          title:
            creditBalance && creditBalance > 0
              ? `${creditBalance} credits available for completed document unlocks`
              : "No credits available for unlocks",
          detail: "Credit balance",
          meta: creditBalance && creditBalance > 0 ? "Ready" : "Low",
          tone: creditBalance && creditBalance > 0 ? ("success" as const) : ("warning" as const),
        },
      ];
    }

    return [
      {
        id: "update-library",
        title: approvedCount > 0 ? `${approvedCount} approved file${approvedCount === 1 ? "" : "s"} ready in library` : "No approved files in library yet",
        detail: "Library status",
        meta: approvedCount > 0 ? "Ready" : "Waiting",
        tone: approvedCount > 0 ? ("success" as const) : ("warning" as const),
      },
      {
        id: "update-submit",
        title: pendingReviewCount > 0 ? `${pendingReviewCount} file${pendingReviewCount === 1 ? "" : "s"} currently waiting for review` : "Submission queue is currently clear",
        detail: "Review queue",
        meta: pendingReviewCount > 0 ? "Action needed" : "Clear",
        tone: pendingReviewCount > 0 ? ("warning" as const) : ("success" as const),
      },
      {
        id: "update-upload",
        title: `${templateCount} template${templateCount === 1 ? "" : "s"}, ${formCount} form${formCount === 1 ? "" : "s"}, ${reportCount} report${reportCount === 1 ? "" : "s"}`,
        detail: "Document mix",
        meta: "Tracked",
        tone: "info" as const,
      },
      {
        id: "update-projects",
        title: uniqueProjects > 0 ? `${uniqueProjects} active project${uniqueProjects === 1 ? "" : "s"} in the workspace` : "No active projects have been named yet",
        detail: "Projects",
        meta: uniqueProjects > 0 ? "Live" : "Waiting",
        tone: uniqueProjects > 0 ? ("success" as const) : ("warning" as const),
      },
    ];
  }, [
    approvedCount,
    companyUserCount,
    creditBalance,
    formCount,
    isManagerView,
    pendingCompanyApprovals,
    pendingReviewCount,
    reportCount,
    templateCount,
    uniqueProjects,
    userTeam,
  ]);

  const systemStatus = isManagerView
    ? [
        {
          label: "Completed Library",
          badge: approvedCount > 0 ? "Ready" : "Waiting",
        },
        {
          label: "Company Users",
          badge: companyUserCount > 0 ? "Active" : "Waiting",
        },
        {
          label: "Company Approval Queue",
          badge: pendingCompanyApprovals > 0 ? "Needs attention" : "Clear",
        },
        {
          label: "Document Access",
          badge: approvedCount > 0 ? "Searchable" : "No records",
        },
      ]
    : [
        {
          label: "Library Access",
          badge: approvedCount > 0 ? "Ready" : "Waiting",
        },
        {
          label: "Review Queue",
          badge: pendingReviewCount > 0 ? "Needs attention" : "Clear",
        },
        {
          label: "Upload Center",
          badge: activeDocuments.length > 0 ? "Active" : "Ready",
        },
        {
          label: "Search Index",
          badge: activeDocuments.length > 0 ? "Searchable" : "No records",
        },
      ];

  const workspaceTools = isManagerView
    ? [
        {
          title: "Open Completed Library",
          note: "Browse the completed documents available to your company account.",
          href: "/library",
        },
        ...(canManageCompanyUsers
          ? [
              {
                title: "Company Users",
                note: "Invite and manage users for your company only.",
                href: "/company-users",
              },
            ]
          : []),
      ]
    : [
        {
          title: "Open Library",
          note: "Browse approved and active project files.",
          href: "/library",
        },
        {
          title: "Search Records",
          note: "Find files by title, type, or category.",
          href: "/search",
        },
        {
          title: "My Purchases",
          note: "Access unlocked completed documents.",
          href: "/purchases",
        },
      ];

  const latestUploaded = useMemo(() => activeDocuments.slice(0, 4), [activeDocuments]);

  const onboardingItems = isManagerView
    ? [
        { label: "Invite your first company user", done: companyUserCount > 0 },
        { label: "Approve company access", done: pendingCompanyApprovals === 0 && companyUserCount > 0 },
        { label: "Open a completed document from the library", done: approvedCount > 0 },
      ]
    : [
        { label: "Upload your first source document", done: activeDocuments.length > 0 },
        { label: "Submit a request for review", done: pendingReviewCount > 0 || approvedCount > 0 },
        { label: "Get an approved file into the library", done: approvedCount > 0 },
        { label: "Open a completed document", done: approvedCount > 0 },
      ];

  const showWelcomeState = !loading && (isManagerView ? companyUserCount === 0 && approvedCount === 0 : activeDocuments.length === 0);
  const companyWorkspaceDisplayLoading = companyWorkspaceLoading || !companyWorkspaceLoaded;

  if (isCompanyAdminDashboard) {
    return (
      <CompanyAdminDashboard
        loading={companyWorkspaceDisplayLoading}
        workspaceLoaded={companyWorkspaceLoaded}
        workspaceError={companyWorkspaceError}
        onRefreshWorkspace={loadCompanyWorkspace}
        documents={activeDocuments}
        companyUsers={companyUsers}
        companyInvites={companyInvites}
        companyProfile={companyProfile}
        jobsites={companyJobsites}
        creditBalance={creditBalance}
        liveMatrixSummary={liveMatrixSummary}
        moduleSummaries={moduleSummaries}
        highRiskAlerts={highRiskAlerts}
        companyDashboardMetrics={companyDashboardMetrics}
        analyticsSummaryIssue={analyticsSummaryIssue}
        workspaceProduct={workspaceProduct}
      />
    );
  }

  if (workspaceProduct === "csep") {
    const csepDocs = activeDocuments.filter((d) => /csep/i.test(d.document_type ?? ""));
    const csepPending = csepDocs.filter((d) =>
      isSubmittedDocumentStatus(d.status, Boolean(d.final_file_path))
    ).length;
    const csepApprovedDocs = csepDocs.filter((d) =>
      isApprovedDocumentStatus(d.status, Boolean(d.final_file_path))
    );
    const csepApproved = csepApprovedDocs.length;

    return (
      <div className="space-y-6">
        <section className="rounded-[1.8rem] border border-[#d9e8ff] bg-slate-900/90 p-6 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
            CSEP workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Your CSEP program</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            This account is limited to the Construction Safety &amp; Environmental Plan builder. Build and submit CSEP
            records for admin review from one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/csep"
              className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
            >
              Open CSEP builder
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Profile
            </Link>
            <Link
              href="/library"
              className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Completed documents
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "CSEP records", value: String(csepDocs.length), note: "All CSEP drafts and submissions" },
            { label: "Pending review", value: String(csepPending), note: "Waiting on admin review" },
            { label: "Approved", value: String(csepApproved), note: "Completed CSEP files" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-black text-white">{loading ? "-" : card.value}</div>
              <p className="mt-2 text-sm text-slate-500">{card.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-100">Completed CSEP documents</h2>
          <p className="mt-1 text-sm text-slate-400">
            Finished files after admin review. Open them here or from the library (sidebar: Completed documents).
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : csepApprovedDocs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No approved CSEP yet. Submit from the builder; your file will show here once an administrator finalizes it.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {csepApprovedDocs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-700/60 bg-slate-950/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">{getDocumentLabel(doc)}</div>
                    <div className="text-xs text-slate-500">
                      {(doc.project_name || "Project").trim() || "Project"} · {formatRelative(doc.created_at)}
                    </div>
                  </div>
                  <Link
                    href="/library"
                    className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Open in library
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-slate-700/60 pt-4">
            <Link href="/library" className="text-sm font-semibold text-sky-300 hover:text-sky-900">
              Browse all completed documents →
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:gap-5">
      <div className="space-y-4 xl:space-y-5">
        <section className="rounded-[1.8rem] border border-[#d9e8ff] bg-slate-900/90 p-6 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                {isManagerView ? "Company Workspace" : "Construction Safety Hub"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {isManagerView ? `${userTeam} Company Workspace` : "Safety360Docs"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {isManagerView
                  ? "Open completed documents and keep company access organized from one clean workspace."
                  : "Manage submissions, approvals, uploads, and project safety documentation from one clean workspace."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={isManagerView ? "/library" : "/submit"}
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
              >
                {isManagerView ? "Open Completed Docs" : "New Submission"}
              </Link>
              <Link
                href={isManagerView ? companyManagementHref : "/upload"}
                className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300"
              >
                {isManagerView ? (canManageCompanyUsers ? "Manage Company Users" : "Completed Library") : "Upload Documents"}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {countCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.4rem] border border-slate-700/80 bg-slate-900/90 p-4 shadow-sm"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-4xl font-black tracking-tight text-white">
                    {loading ? "-" : card.value}
                  </div>
                  <DashboardIcon kind={card.icon} />
                </div>
                <p className="mt-4 text-sm text-slate-500">{card.note}</p>
                <div className="mt-3 text-sm font-semibold text-emerald-600">
                  {card.trend}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {workspaceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-[1.4rem] border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm transition hover:border-sky-500/35 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-950/35 text-[11px] font-black text-sky-300">
                      D
                    </span>
                    <span className="text-lg font-bold text-slate-100">{card.title}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Open</span>
                </div>
                <div className="mt-5 text-4xl font-black tracking-tight text-white">
                  {loading ? "-" : card.value}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {!isCompanyAdminDashboard && companyWorkspaceLoaded && analyticsSummaryIssue ? (
          <InlineMessage tone={analyticsSummaryIssue.tone}>{analyticsSummaryIssue.message}</InlineMessage>
        ) : null}

        {showWelcomeState ? (
          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              title="Welcome to your workspace"
              description="Start with the core flow below so your first document moves cleanly from intake to approval."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(isManagerView
                  ? [
                      { title: canManageCompanyUsers ? "Invite" : "Library", note: canManageCompanyUsers ? "Add a user to your company workspace." : "Open completed documents for your company.", href: canManageCompanyUsers ? "/company-users" : "/library" },
                      { title: canManageCompanyUsers ? "Approve" : "Access", note: canManageCompanyUsers ? "Activate or suspend company access as needed." : "Your role stays limited to completed company documents.", href: canManageCompanyUsers ? "/company-users" : "/dashboard" },
                      { title: "Library", note: "Open completed documents from one place.", href: "/library" },
                    ]
                  : [
                      { title: "Upload", note: "Add source files and templates.", href: "/upload" },
                      { title: "Submit", note: "Send work into the review queue.", href: "/submit" },
                      { title: "Review", note: "Admins approve and finalize records.", href: "/admin/review-documents" },
                      { title: "Library", note: "Open completed documents from one place.", href: "/library" },
                    ]).map((step, index) => (
                  <Link
                    key={step.title}
                    href={step.href}
                    className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-sky-500/35 hover:bg-sky-950/35"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Step {index + 1}
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-100">{step.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{step.note}</div>
                  </Link>
                ))}
              </div>
            </SectionCard>

            <StartChecklist title="Start Here Checklist" items={onboardingItems} />
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:gap-5">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-slate-900/90 p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {actionCards.map((action) => (
                <div
                  key={action.title}
                  className="rounded-[1.4rem] border border-slate-700/80 bg-slate-900/90 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-950/35 text-[11px] font-black text-sky-300">
                      A
                    </span>
                    <span className="text-lg font-bold text-slate-100">{action.title}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{action.description}</p>
                  <Link
                    href={action.href}
                    className="mt-5 inline-flex rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(91,108,255,0.18)]"
                  >
                    {action.button}
                  </Link>
                </div>
              ))}
            </div>

            {isManagerView && companyProfile ? (
              <div className="mt-5 rounded-[1.4rem] border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Company Profile
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {companyProfile.name || userTeam}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {companyProfile.industry || "Industry not set"}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {companyProfile.primary_contact_name || "No contact set"}
                    {companyProfile.primary_contact_email
                      ? ` - ${companyProfile.primary_contact_email}`
                      : ""}
                  </div>
                  <div className="text-sm text-slate-500">
                    {companyProfile.phone || "No phone on file"}
                  </div>
                  <div className="text-sm text-slate-500">
                    {companyProfile.website || "No website on file"}
                  </div>
                  <div className="text-sm text-slate-500 sm:col-span-2">
                    {[
                      companyProfile.address_line_1,
                      companyProfile.city,
                      companyProfile.state_region,
                      companyProfile.postal_code,
                      companyProfile.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address on file"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <ActivityFeed
            title="Latest Updates"
            description="Live signals based on your current workspace records."
            items={latestUpdates}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr] xl:gap-5">
          <ActivityFeed
            title="Recent Activity"
            description="The latest document movement inside your workspace."
            items={recentActivity}
          />

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-slate-900/90 p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                Workspace Status
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Real-time view of the main tools in this portal.
              </p>

              <div className="mt-5 space-y-3">
                {systemStatus.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-4"
                  >
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                    <StatusBadge label={item.badge} tone={getStatusTone(item.badge)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-slate-900/90 p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                Workspace Tools
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Jump straight into the most-used parts of the app.
              </p>

              <div className="mt-5 space-y-3">
                {workspaceTools.map((tool) => (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="block rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-4 transition hover:border-sky-500/35 hover:shadow-sm"
                  >
                    <div className="text-sm font-semibold text-slate-100">{tool.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{tool.note}</div>
                  </Link>
                ))}
              </div>
            </div>

            <WorkflowPath
              title="Workflow Path"
              description={
                isManagerView
                  ? "Company roles stay focused on completed documents and company access."
                  : "The standard route for a document moving through the platform."
              }
              steps={
                isManagerView
                  ? [
                      {
                        label: "Invite users",
                          detail: canManageCompanyUsers ? "Add team members to your company workspace." : "Open completed files in the company library.",
                          complete: companyUserCount > 0,
                        },
                        {
                          label: canManageCompanyUsers ? "Approve access" : "Completed docs",
                          detail: canManageCompanyUsers ? "Activate or suspend company users as needed." : "Approved files stay available in one company-scoped library.",
                          active: canManageCompanyUsers ? pendingCompanyApprovals > 0 : approvedCount > 0,
                          complete: canManageCompanyUsers ? companyUserCount > 0 : approvedCount > 0,
                        },
                        {
                          label: canManageCompanyUsers ? "Completed docs" : "Company workspace",
                          detail: canManageCompanyUsers ? "Open the finished documents already available to your company account." : "Your company access stays scoped to completed documents only.",
                          complete: approvedCount > 0,
                        },
                    ]
                  : [
                      {
                        label: "Upload",
                        detail: "Add source files, templates, or supporting documents.",
                        complete: activeDocuments.length > 0,
                      },
                      {
                        label: "Submit",
                        detail: "Send records into the review workflow for approval.",
                        active: pendingReviewCount > 0,
                        complete: pendingReviewCount > 0 || approvedCount > 0,
                      },
                      {
                        label: "Review",
                        detail: "Admins review content, finalize records, and clear the queue.",
                        active: pendingReviewCount > 0,
                        complete: approvedCount > 0,
                      },
                      {
                        label: "Library",
                        detail: "Approved files become ready to open from one central place.",
                        complete: approvedCount > 0,
                      },
                    ]
              }
            />
          </div>
        </section>

        <SectionCard
          title={isManagerView ? "Latest Completed Documents" : "Latest Uploaded Files"}
          description={
            isManagerView
              ? "The most recent completed files available to this company account."
              : "The most recent records added to the workspace."
          }
          aside={
            <Link
              href={isManagerView ? "/library" : "/upload"}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              {isManagerView ? "Open Library" : "Open Uploads"}
            </Link>
          }
        >
          {latestUploaded.length === 0 ? (
            <EmptyState
              title={isManagerView ? "No completed documents yet" : "No uploaded files yet"}
              description={
                isManagerView
                  ? "Completed documents available to your company account will appear here."
                  : "Add a document first, then submit it for review so it can move into the library."
              }
              actionHref={isManagerView ? (canManageCompanyUsers ? "/company-users" : "/library") : "/upload"}
              actionLabel={isManagerView ? (canManageCompanyUsers ? "Manage Company Users" : "Open Library") : "Upload First File"}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {latestUploaded.map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">
                        {getDocumentLabel(document)}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {document.document_type || "Document"}
                      </div>
                    </div>
                    <span className="rounded-full bg-sky-950/35 px-3 py-1 text-xs font-semibold text-sky-300">
                      {getStatusLabel(document)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-500">
                    {document.project_name || document.category || "General workspace file"}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Uploaded {formatRelative(document.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <aside className="order-first rounded-[1.8rem] border border-slate-800 bg-[linear-gradient(180deg,_#20365f_0%,_#203455_100%)] p-5 text-white shadow-[0_16px_35px_rgba(15,23,42,0.22)] xl:order-none">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-300">
          {isManagerView ? "Company Access Status" : "Site Safety Status"}
        </div>
        <div className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
          {isManagerView ? "Today&apos;s Company Workspace" : "Today&apos;s Workspace"}
        </div>

        <div className="mt-3 text-sm leading-6 text-slate-300">
          {isManagerView
            ? "Keep company access organized and open completed documents without exposing draft workflows."
            : "Keep submissions moving, review new activity, and open the tools your team uses most."}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={isManagerView ? "/library" : "/peshep"}
            className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-xs font-semibold text-white sm:text-sm"
          >
            {isManagerView ? "Open Library" : "Build PESHEP"}
          </Link>
          <Link
            href={isManagerView ? companyManagementHref : "/submit"}
            className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-xs font-semibold text-slate-100 sm:text-sm"
          >
            {isManagerView ? (canManageCompanyUsers ? "Manage Users" : "Open Library") : "Submit Request"}
          </Link>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">
              {isManagerView ? "Company Activity" : "Current Activity"}
            </div>
            <Link
              href={isManagerView ? companyManagementHref : "/submit"}
              className="text-xs font-medium text-slate-300"
            >
              {isManagerView ? (canManageCompanyUsers ? "Manage Users" : "Open Library") : "View Queue"}
            </Link>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <div className="text-sm font-semibold text-white">
              {isManagerView ? "Company Access Items" : "Items Waiting Review"}
            </div>
            <div className="mt-4 space-y-3">
              {reviewQueueItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-300">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DashboardIcon({ kind }: { kind: CountCard["icon"] }) {
  const common = "h-9 w-9";

  if (kind === "projects") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path d="M4 18h16" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7 18v-6" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 18V8" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 18v-3" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7" cy="10" r="2" fill="#BFDBFE" />
        <circle cx="12" cy="6" r="2" fill="#93C5FD" />
        <circle cx="17" cy="13" r="2" fill="#DBEAFE" />
      </svg>
    );
  }

  if (kind === "review") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <rect x="6" y="4" width="12" height="16" rx="2" fill="#DBEAFE" />
        <path d="M9 9h6M9 13h4" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="16.5" cy="15.5" r="3.5" fill="#FDE68A" />
      </svg>
    );
  }

  if (kind === "approved") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path
          d="M12 3 6 5.5v5.3c0 4.2 2.7 8 6 9.2 3.3-1.2 6-5 6-9.2V5.5L12 3Z"
          fill="#93C5FD"
        />
        <path
          d="m9.5 12 1.8 1.8L15 10.1"
          stroke="#1D4ED8"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
      <rect x="5" y="4" width="14" height="16" rx="2" fill="#BFDBFE" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
