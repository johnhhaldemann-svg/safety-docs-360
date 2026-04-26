import { userMaySelectAnyCompanyContractor } from "@/lib/dashboardOverviewAccess";
import { getPermissionMap, normalizeAppRole } from "@/lib/rbac";
import type { PermissionMap } from "@/lib/rbac";

/**
 * Which prevention overview sections render for the current account.
 * Uses existing RBAC + contractor scope from {@link userMaySelectAnyCompanyContractor}.
 */
export type DashboardOverviewSectionVisibility = {
  /** Section 1 — full KPI grid vs field-user subset */
  preventionHeadlineMode: "full" | "field";
  showForecast: boolean;
  showEmergingThemes: boolean;
  showObservationMix: boolean;
  showCorrectiveCenter: boolean;
  showPermits: boolean;
  showContractorScorecards: boolean;
  showWorkforceReadiness: boolean;
  showDocumentReadiness: boolean;
  showAiInsights: boolean;
  showEngineHealth: boolean;
  /** Section 11 — platform diagnostics + link to Superadmin System Health */
  showSuperadminPlatformHealth: boolean;
};

export function getDashboardOverviewSectionVisibility(params: {
  userRole: string;
  permissionMap: PermissionMap | null;
  linkedContractorId: string | null;
}): DashboardOverviewSectionVisibility {
  const role = normalizeAppRole(params.userRole);
  const map = params.permissionMap ?? getPermissionMap(params.userRole);
  const mayCompareContractors = userMaySelectAnyCompanyContractor({
    role: params.userRole,
    permissionMap: map,
  });
  const contractorPortal =
    Boolean(params.linkedContractorId) && !mayCompareContractors;

  const isSuperPlatform = role === "super_admin" || role === "platform_admin";

  if (role === "field_user") {
    return {
      preventionHeadlineMode: "field",
      showForecast: false,
      showEmergingThemes: false,
      showObservationMix: true,
      showCorrectiveCenter: true,
      showPermits: false,
      showContractorScorecards: false,
      showWorkforceReadiness: true,
      showDocumentReadiness: false,
      showAiInsights: false,
      showEngineHealth: false,
      showSuperadminPlatformHealth: false,
    };
  }

  if (contractorPortal) {
    return {
      preventionHeadlineMode: "full",
      showForecast: true,
      showEmergingThemes: true,
      showObservationMix: true,
      showCorrectiveCenter: true,
      showPermits: true,
      showContractorScorecards: false,
      showWorkforceReadiness: true,
      showDocumentReadiness: true,
      showAiInsights: true,
      showEngineHealth: true,
      showSuperadminPlatformHealth: false,
    };
  }

  return {
    preventionHeadlineMode: "full",
    showForecast: true,
    showEmergingThemes: true,
    showObservationMix: true,
    showCorrectiveCenter: true,
    showPermits: true,
    showContractorScorecards: true,
    showWorkforceReadiness: true,
    showDocumentReadiness: true,
    showAiInsights: true,
    showEngineHealth: true,
    showSuperadminPlatformHealth: isSuperPlatform,
  };
}
