import { describe, expect, it } from "vitest";
import { getDashboardOverviewSectionVisibility } from "@/lib/dashboardVisibility";
import type { PermissionMap } from "@/lib/rbac";

const fullPerms: PermissionMap = {
  can_create_documents: true,
  can_edit_documents: true,
  can_submit_documents: true,
  can_review_documents: true,
  can_approve_documents: true,
  can_manage_users: true,
  can_manage_company_users: true,
  can_manage_billing: true,
  can_view_analytics: true,
  can_assign_roles: true,
  can_access_internal_admin: true,
  can_view_all_company_data: true,
  can_manage_global_templates: true,
  can_override_system_controls: true,
  can_manage_daps: true,
  can_manage_observations: true,
  can_verify_closures: true,
  can_escalate_items: true,
  can_view_dashboards: true,
  can_view_reports: true,
};

describe("getDashboardOverviewSectionVisibility", () => {
  it("shows platform system health only for super_admin and platform_admin", () => {
    const superV = getDashboardOverviewSectionVisibility({
      userRole: "super_admin",
      permissionMap: fullPerms,
      linkedContractorId: null,
    });
    expect(superV.showSuperadminPlatformHealth).toBe(true);

    const platformV = getDashboardOverviewSectionVisibility({
      userRole: "platform_admin",
      permissionMap: fullPerms,
      linkedContractorId: null,
    });
    expect(platformV.showSuperadminPlatformHealth).toBe(true);

    const adminV = getDashboardOverviewSectionVisibility({
      userRole: "company_admin",
      permissionMap: fullPerms,
      linkedContractorId: null,
    });
    expect(adminV.showSuperadminPlatformHealth).toBe(false);
  });

  it("hides contractor scorecards for linked contractor accounts without directory privileges", () => {
    const v = getDashboardOverviewSectionVisibility({
      userRole: "field_supervisor",
      permissionMap: null,
      linkedContractorId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(v.showContractorScorecards).toBe(false);
    expect(v.showForecast).toBe(true);
  });

  it("uses a trimmed prevention overview for field_user", () => {
    const v = getDashboardOverviewSectionVisibility({
      userRole: "field_user",
      permissionMap: null,
      linkedContractorId: null,
    });
    expect(v.preventionHeadlineMode).toBe("field");
    expect(v.showForecast).toBe(false);
    expect(v.showPermits).toBe(false);
    expect(v.showContractorScorecards).toBe(false);
    expect(v.showDocumentReadiness).toBe(false);
    expect(v.showEngineHealth).toBe(false);
    expect(v.showObservationMix).toBe(true);
    expect(v.showCorrectiveCenter).toBe(true);
  });
});
