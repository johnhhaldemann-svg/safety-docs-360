import { describe, expect, it } from "vitest";
import type { PermissionMap } from "@/lib/rbac";
import {
  canAccessCompanyJobsites,
  canAccessCompanyWorkspaceHref,
  canBuildCompanyDocuments,
  canManageCompanyIncidents,
  canManageCompanyJsa,
  canManageCompanyPermits,
  canMutateCompanyTrainingRequirements,
  canSubmitCompanyDocuments,
  canViewCompanyTrainingMatrix,
} from "@/lib/companyFeatureAccess";

function buildPermissionMap(overrides: Partial<PermissionMap> = {}): PermissionMap {
  return {
    can_create_documents: false,
    can_edit_documents: false,
    can_submit_documents: false,
    can_review_documents: false,
    can_approve_documents: false,
    can_manage_users: false,
    can_manage_company_users: false,
    can_manage_billing: false,
    can_view_analytics: false,
    can_assign_roles: false,
    can_access_internal_admin: false,
    can_view_all_company_data: false,
    can_manage_global_templates: false,
    can_override_system_controls: false,
    can_manage_daps: false,
    can_manage_observations: false,
    can_verify_closures: false,
    can_escalate_items: false,
    can_view_dashboards: false,
    can_view_reports: false,
    ...overrides,
  };
}

describe("companyFeatureAccess", () => {
  it("allows project managers, field supervisors, and foremen into the JSA workspace", () => {
    const permissions = buildPermissionMap({
      can_create_documents: true,
      can_edit_documents: true,
    });

    expect(canManageCompanyJsa("project_manager", permissions)).toBe(true);
    expect(canManageCompanyJsa("field_supervisor", permissions)).toBe(true);
    expect(canManageCompanyJsa("foreman", permissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/jsa", "project_manager", permissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/jsa", "field_supervisor", permissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/jsa", "foreman", permissions)).toBe(true);
    expect(canAccessCompanyJobsites("field_supervisor", permissions)).toBe(true);
  });

  it("keeps permits and incidents scoped to company leadership roles", () => {
    const permissions = buildPermissionMap({
      can_create_documents: true,
      can_edit_documents: true,
    });

    expect(canManageCompanyPermits("project_manager", permissions)).toBe(false);
    expect(canManageCompanyPermits("field_supervisor", permissions)).toBe(false);
    expect(canManageCompanyIncidents("foreman", permissions)).toBe(false);
    expect(canManageCompanyIncidents("field_supervisor", permissions)).toBe(false);
    expect(canManageCompanyPermits("safety_manager", permissions)).toBe(true);
    expect(canManageCompanyIncidents("company_admin", permissions)).toBe(true);
  });

  it("shows the training matrix for project managers but not foremen by default", () => {
    expect(canViewCompanyTrainingMatrix("project_manager")).toBe(true);
    expect(canViewCompanyTrainingMatrix("foreman")).toBe(false);
    expect(canMutateCompanyTrainingRequirements("project_manager")).toBe(false);
    expect(canMutateCompanyTrainingRequirements("manager")).toBe(true);
  });

  it("allows permission-map grants to unlock training and jobsites access", () => {
    const permissions = buildPermissionMap({
      can_manage_company_users: true,
      can_view_dashboards: true,
    });

    expect(canViewCompanyTrainingMatrix("field_user", permissions)).toBe(true);
    expect(canMutateCompanyTrainingRequirements("field_user", permissions)).toBe(true);
    expect(canAccessCompanyJobsites("read_only", permissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/jobsites", "field_user", permissions)).toBe(true);
  });

  it("respects document capability overrides for editable workspaces", () => {
    const noDocumentAccess = buildPermissionMap();

    expect(canManageCompanyJsa("project_manager", noDocumentAccess)).toBe(false);
    expect(canManageCompanyPermits("safety_manager", noDocumentAccess)).toBe(false);
    expect(canManageCompanyIncidents("company_admin", noDocumentAccess)).toBe(false);
    expect(canSubmitCompanyDocuments(noDocumentAccess)).toBe(false);
    expect(canBuildCompanyDocuments(noDocumentAccess)).toBe(false);
    expect(canAccessCompanyWorkspaceHref("/submit", "field_user", noDocumentAccess)).toBe(false);
    expect(canAccessCompanyWorkspaceHref("/upload", "field_user", noDocumentAccess)).toBe(false);
  });

  it("allows sales demo accounts to showcase company workspace operators", () => {
    const demoPermissions = buildPermissionMap({
      can_create_documents: true,
      can_edit_documents: true,
      can_submit_documents: true,
      can_manage_company_users: true,
      can_view_all_company_data: true,
      can_view_dashboards: true,
      can_view_reports: true,
    });

    expect(canViewCompanyTrainingMatrix("sales_demo", demoPermissions)).toBe(true);
    expect(canManageCompanyJsa("sales_demo", demoPermissions)).toBe(true);
    expect(canManageCompanyPermits("sales_demo", demoPermissions)).toBe(true);
    expect(canManageCompanyIncidents("sales_demo", demoPermissions)).toBe(true);
    expect(canAccessCompanyJobsites("sales_demo", demoPermissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/jobsites", "sales_demo", demoPermissions)).toBe(true);
    expect(canAccessCompanyWorkspaceHref("/submit", "sales_demo", demoPermissions)).toBe(true);
  });
});
