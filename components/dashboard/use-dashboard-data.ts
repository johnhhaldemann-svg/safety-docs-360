"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout, fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { buildSalesDemoDashboardData } from "@/lib/demoWorkspace";
import { emptyOnboardingState, type OnboardingState } from "@/lib/onboardingState";
import { getPermissionMap, type PermissionMap } from "@/lib/rbac";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { WorkspaceProduct } from "@/lib/workspaceProduct";
import type {
  DashboardAnalyticsSummary,
  DashboardBanner,
  DashboardCompanyInvite,
  DashboardCompanyProfile,
  DashboardCompanyUser,
  DashboardDataState,
  DashboardDocument,
  DashboardRevenueReadiness,
  DashboardWorkspaceSummary,
} from "@/components/dashboard/types";
import type { DashboardHomeMetrics } from "@/lib/dashboardAnalytics";

const supabase = getSupabaseBrowserClient();

function emptyWorkspaceSummary(): DashboardWorkspaceSummary {
  return {
    jobsites: [],
    observations: [],
    daps: [],
    permits: [],
    incidents: [],
    reports: [],
  };
}

function isMissingJsaRelationError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
}

function buildAnalyticsBanner(
  response: Response,
  payload: { error?: string; warning?: string } | null
): DashboardBanner {
  const errorMessage = typeof payload?.error === "string" ? payload.error.trim() : "";
  const warningMessage = typeof payload?.warning === "string" ? payload.warning.trim() : "";
  const syncWarning =
    isMissingJsaRelationError(errorMessage) || isMissingJsaRelationError(warningMessage);

  if (!response.ok) {
    return {
      message:
        syncWarning
          ? "JSA analytics are still syncing. Refresh in a moment for the latest counts."
          : errorMessage || warningMessage || "Company analytics summary could not be loaded.",
      tone: syncWarning ? "warning" : "error",
    };
  }

  if (warningMessage) {
    return {
      message: warningMessage,
      tone: syncWarning ? "warning" : "error",
    };
  }

  return null;
}

export function useDashboardData(): DashboardDataState {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("viewer");
  const [userTeam, setUserTeam] = useState("General");
  const [linkedContractorId, setLinkedContractorId] = useState<string | null>(null);
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [companyProfile, setCompanyProfile] = useState<DashboardCompanyProfile | null>(null);
  const [workspaceProduct, setWorkspaceProduct] = useState<WorkspaceProduct>("full");
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [companyUsers, setCompanyUsers] = useState<DashboardCompanyUser[]>([]);
  const [companyInvites, setCompanyInvites] = useState<DashboardCompanyInvite[]>([]);
  const [workspaceSummary, setWorkspaceSummary] = useState<DashboardWorkspaceSummary>(
    emptyWorkspaceSummary
  );
  const [analyticsSummary, setAnalyticsSummary] = useState<DashboardAnalyticsSummary>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardHomeMetrics | null>(null);
  const [revenueReadiness, setRevenueReadiness] = useState<DashboardRevenueReadiness>(null);
  const [companyWorkspaceLoaded, setCompanyWorkspaceLoaded] = useState(false);
  const [companyWorkspaceLoading, setCompanyWorkspaceLoading] = useState(false);
  const [companyWorkspaceError, setCompanyWorkspaceError] = useState<string | null>(null);
  const [analyticsSummaryIssue, setAnalyticsSummaryIssue] = useState<DashboardBanner>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(emptyOnboardingState());

  const refreshCompanyWorkspace = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setCompanyUsers([]);
      setCompanyInvites([]);
      setWorkspaceSummary(emptyWorkspaceSummary());
      setAnalyticsSummary(null);
      setDashboardMetrics(null);
      setRevenueReadiness(null);
      setCompanyWorkspaceLoaded(true);
      setCompanyWorkspaceLoading(false);
      setCompanyWorkspaceError(null);
      setAnalyticsSummaryIssue(null);
      setOnboardingState(emptyOnboardingState());
      return;
    }

    setCompanyWorkspaceLoading(true);
    setCompanyWorkspaceError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [companyResponse, workspaceResponse, analyticsResponse, dashboardMetricsResponse] =
        await Promise.all([
          fetchWithTimeoutSafe("/api/company/users", { headers }, 15000, "Company directory"),
          fetchWithTimeoutSafe(
            "/api/company/workspace/summary",
            { headers },
            15000,
            "Workspace summary"
          ),
          fetchWithTimeoutSafe(
            "/api/company/analytics/summary?days=30",
            { headers },
            15000,
            "Analytics summary"
          ),
          fetchWithTimeoutSafe(
            "/api/company/dashboard-metrics?days=30",
            { headers },
            15000,
            "Dashboard metrics"
          ),
        ]);

      const companyData = (await companyResponse.json().catch(() => null)) as
        | { users?: DashboardCompanyUser[]; invites?: DashboardCompanyInvite[]; error?: string }
        | null;
      const workspaceData = (await workspaceResponse.json().catch(() => null)) as
        | (DashboardWorkspaceSummary & { error?: string })
        | null;
      const analyticsData = (await analyticsResponse.json().catch(() => null)) as
        | { summary?: DashboardAnalyticsSummary; error?: string; warning?: string }
        | null;
      const dashboardMetricsData = (await dashboardMetricsResponse.json().catch(() => null)) as
        | { metrics?: DashboardHomeMetrics; error?: string }
        | null;

      setCompanyUsers(companyResponse.ok ? companyData?.users ?? [] : []);
      setCompanyInvites(companyResponse.ok ? companyData?.invites ?? [] : []);
      setWorkspaceSummary(
        workspaceResponse.ok
          ? {
              jobsites: workspaceData?.jobsites ?? [],
              observations: workspaceData?.observations ?? [],
              daps: workspaceData?.daps ?? [],
              permits: workspaceData?.permits ?? [],
              incidents: workspaceData?.incidents ?? [],
              reports: workspaceData?.reports ?? [],
            }
          : emptyWorkspaceSummary()
      );
      setAnalyticsSummary(analyticsData?.summary ?? null);
      setDashboardMetrics(
        dashboardMetricsResponse.ok && dashboardMetricsData?.metrics
          ? dashboardMetricsData.metrics
          : null
      );
      setAnalyticsSummaryIssue(buildAnalyticsBanner(analyticsResponse, analyticsData));

      if (!workspaceResponse.ok) {
        setCompanyWorkspaceError(workspaceData?.error || "Workspace summary could not be loaded.");
      } else if (!companyResponse.ok) {
        setCompanyWorkspaceError(companyData?.error || "Company directory could not be loaded.");
      } else {
        setCompanyWorkspaceError(null);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setCompanyWorkspaceError("Workspace summary could not be loaded.");
      }
      setWorkspaceSummary(emptyWorkspaceSummary());
      setAnalyticsSummary(null);
      setDashboardMetrics(null);
      setRevenueReadiness(null);
      setAnalyticsSummaryIssue({
        message: "Analytics summary could not be loaded.",
        tone: "error",
      });
    } finally {
      setCompanyWorkspaceLoaded(true);
      setCompanyWorkspaceLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setLoading(false);
      setUserRole("viewer");
      setUserTeam("General");
      setLinkedContractorId(null);
      setPermissionMap(null);
      setCompanyProfile(null);
      setWorkspaceProduct("full");
      setDocuments([]);
      setCreditBalance(null);
      setCompanyUsers([]);
      setCompanyInvites([]);
      setWorkspaceSummary(emptyWorkspaceSummary());
      setAnalyticsSummary(null);
      setDashboardMetrics(null);
      setCompanyWorkspaceLoaded(true);
      setCompanyWorkspaceLoading(false);
      setCompanyWorkspaceError(null);
      setAnalyticsSummaryIssue(null);
      setOnboardingState(emptyOnboardingState());
      return;
    }

    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [meResponse, documentsResponse, creditResponse] = await Promise.all([
        fetchWithTimeout("/api/auth/me", { headers }, 15000),
        fetchWithTimeout("/api/workspace/documents", { headers }, 15000),
        fetchWithTimeout("/api/library/credits", { headers }, 15000),
      ]);

      const meData = (await meResponse.json().catch(() => null)) as
        | {
            user?: {
              role?: string;
              team?: string;
              linkedContractorId?: string | null;
              permissionMap?: PermissionMap;
              companyProfile?: DashboardCompanyProfile | null;
              workspaceProduct?: WorkspaceProduct;
            };
          }
        | null;
      const documentsData = (await documentsResponse.json().catch(() => null)) as
        | { documents?: DashboardDocument[] }
        | null;
      const creditData = (await creditResponse.json().catch(() => null)) as
        | { creditBalance?: number }
        | null;

      const nextRole = meData?.user?.role ?? "viewer";
      const nextPermissions = meData?.user?.permissionMap ?? getPermissionMap(nextRole);
      const nextWorkspaceProduct: WorkspaceProduct =
        meData?.user?.workspaceProduct === "csep" ? "csep" : "full";

      if (nextRole === "sales_demo") {
        const demoData = buildSalesDemoDashboardData({
          refreshCompanyWorkspace,
          reload: async () => {},
        });
        setUserRole(demoData.userRole);
        setUserTeam(demoData.userTeam);
        setLinkedContractorId(null);
        setPermissionMap(demoData.permissionMap);
        setCompanyProfile(demoData.companyProfile);
        setWorkspaceProduct(demoData.workspaceProduct);
        setDocuments(demoData.documents);
        setCreditBalance(demoData.creditBalance);
        setCompanyUsers(demoData.companyUsers);
        setCompanyInvites(demoData.companyInvites);
        setWorkspaceSummary(demoData.workspaceSummary);
        setAnalyticsSummary(demoData.analyticsSummary);
        setDashboardMetrics(demoData.dashboardMetrics);
        setRevenueReadiness({
          score: 88,
          band: "Ready to sell",
          activationPercent: 92,
          operationsPercent: 84,
          billingPercent: 86,
          retentionPercent: 89,
          nextActions: [
            {
              id: "demo-high-risk-week",
              label: "Walk through high-risk week",
              detail: "Use Command Center to connect risk, open work, and follow-up actions.",
              href: "/command-center",
              priority: "medium",
            },
          ],
          counts: {
            openWork: 7,
            overdueWork: 1,
            activeJobsites: demoData.workspaceSummary.jobsites.length,
            documentsStarted: demoData.documents.length,
          },
        });
        setCompanyWorkspaceLoaded(true);
        setCompanyWorkspaceLoading(false);
        setCompanyWorkspaceError(null);
        setAnalyticsSummaryIssue(null);
        setOnboardingState(demoData.onboardingState);
        return;
      }

      setUserRole(nextRole);
      setUserTeam(meData?.user?.team ?? "General");
      {
        const rawLinked = meData?.user?.linkedContractorId;
        setLinkedContractorId(
          typeof rawLinked === "string" && rawLinked.trim().length > 0 ? rawLinked.trim() : null
        );
      }
      setPermissionMap(nextPermissions);
      setCompanyProfile(meData?.user?.companyProfile ?? null);
      setWorkspaceProduct(nextWorkspaceProduct);
      setDocuments(documentsResponse.ok ? documentsData?.documents ?? [] : []);
      setCreditBalance(creditResponse.ok ? Number(creditData?.creditBalance ?? 0) : null);
      const onboardingResponse = await fetchWithTimeoutSafe(
        "/api/onboarding/state",
        { headers },
        10000,
        "Onboarding state"
      );
      const onboardingData = (await onboardingResponse.json().catch(() => null)) as
        | OnboardingState
        | null;
      setOnboardingState(onboardingResponse.ok && onboardingData ? onboardingData : emptyOnboardingState());

      const canLoadCompanyWorkspace =
        nextWorkspaceProduct !== "csep" &&
        Boolean(
          nextPermissions.can_manage_company_users ||
            nextPermissions.can_manage_users ||
            nextPermissions.can_view_analytics ||
            nextPermissions.can_view_all_company_data ||
            nextPermissions.can_view_dashboards
        );

      if (canLoadCompanyWorkspace) {
        await refreshCompanyWorkspace();
        const progressResponse = await fetchWithTimeoutSafe(
          "/api/company/onboarding/progress",
          { headers },
          15000,
          "Onboarding progress"
        );
        const progressData = (await progressResponse.json().catch(() => null)) as
          | { progress?: DashboardRevenueReadiness }
          | null;
        setRevenueReadiness(progressResponse.ok ? progressData?.progress ?? null : null);
      } else {
        setCompanyUsers([]);
        setCompanyInvites([]);
        setWorkspaceSummary(emptyWorkspaceSummary());
        setAnalyticsSummary(null);
        setDashboardMetrics(null);
        setRevenueReadiness(null);
        setCompanyWorkspaceLoaded(true);
        setCompanyWorkspaceLoading(false);
        setCompanyWorkspaceError(null);
        setAnalyticsSummaryIssue(null);
        setOnboardingState(emptyOnboardingState());
      }
    } finally {
      setLoading(false);
    }
  }, [refreshCompanyWorkspace]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    userRole,
    userTeam,
    linkedContractorId,
    permissionMap,
    companyProfile,
    workspaceProduct,
    documents,
    creditBalance,
    companyUsers,
    companyInvites,
    workspaceSummary,
    analyticsSummary,
    dashboardMetrics,
    revenueReadiness,
    companyWorkspaceLoaded,
    companyWorkspaceLoading,
    companyWorkspaceError,
    analyticsSummaryIssue,
    onboardingState,
    refreshCompanyWorkspace,
    reload,
  };
}
