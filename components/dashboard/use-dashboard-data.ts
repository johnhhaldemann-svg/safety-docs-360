"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout, fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
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
  DashboardWorkspaceSummary,
} from "@/components/dashboard/types";

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
  const [companyWorkspaceLoaded, setCompanyWorkspaceLoaded] = useState(false);
  const [companyWorkspaceLoading, setCompanyWorkspaceLoading] = useState(false);
  const [companyWorkspaceError, setCompanyWorkspaceError] = useState<string | null>(null);
  const [analyticsSummaryIssue, setAnalyticsSummaryIssue] = useState<DashboardBanner>(null);

  const refreshCompanyWorkspace = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setCompanyUsers([]);
      setCompanyInvites([]);
      setWorkspaceSummary(emptyWorkspaceSummary());
      setAnalyticsSummary(null);
      setCompanyWorkspaceLoaded(true);
      setCompanyWorkspaceLoading(false);
      setCompanyWorkspaceError(null);
      setAnalyticsSummaryIssue(null);
      return;
    }

    setCompanyWorkspaceLoading(true);
    setCompanyWorkspaceError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [companyResponse, workspaceResponse, analyticsResponse] = await Promise.all([
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
      setPermissionMap(null);
      setCompanyProfile(null);
      setWorkspaceProduct("full");
      setDocuments([]);
      setCreditBalance(null);
      setCompanyUsers([]);
      setCompanyInvites([]);
      setWorkspaceSummary(emptyWorkspaceSummary());
      setAnalyticsSummary(null);
      setCompanyWorkspaceLoaded(true);
      setCompanyWorkspaceLoading(false);
      setCompanyWorkspaceError(null);
      setAnalyticsSummaryIssue(null);
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

      setUserRole(nextRole);
      setUserTeam(meData?.user?.team ?? "General");
      setPermissionMap(nextPermissions);
      setCompanyProfile(meData?.user?.companyProfile ?? null);
      setWorkspaceProduct(nextWorkspaceProduct);
      setDocuments(documentsResponse.ok ? documentsData?.documents ?? [] : []);
      setCreditBalance(creditResponse.ok ? Number(creditData?.creditBalance ?? 0) : null);

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
      } else {
        setCompanyUsers([]);
        setCompanyInvites([]);
        setWorkspaceSummary(emptyWorkspaceSummary());
        setAnalyticsSummary(null);
        setCompanyWorkspaceLoaded(true);
        setCompanyWorkspaceLoading(false);
        setCompanyWorkspaceError(null);
        setAnalyticsSummaryIssue(null);
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
    permissionMap,
    companyProfile,
    workspaceProduct,
    documents,
    creditBalance,
    companyUsers,
    companyInvites,
    workspaceSummary,
    analyticsSummary,
    companyWorkspaceLoaded,
    companyWorkspaceLoading,
    companyWorkspaceError,
    analyticsSummaryIssue,
    refreshCompanyWorkspace,
    reload,
  };
}
