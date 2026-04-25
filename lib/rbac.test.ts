import { describe, expect, it } from "vitest";
import {
  formatAppRole,
  getPermissionMap,
  isCompanyRole,
  normalizeAppRole,
} from "@/lib/rbac";

describe("sales_demo role", () => {
  it("normalizes and formats the role label", () => {
    expect(normalizeAppRole("sales_demo")).toBe("sales_demo");
    expect(normalizeAppRole("Sales Demo")).toBe("sales_demo");
    expect(formatAppRole("sales_demo")).toBe("Sales Demo");
  });

  it("keeps sales demo as an internal role", () => {
    expect(isCompanyRole("sales_demo")).toBe(false);
  });

  it("grants company showcase permissions without internal admin powers", () => {
    const permissionMap = getPermissionMap("sales_demo");

    expect(permissionMap.can_view_dashboards).toBe(true);
    expect(permissionMap.can_view_reports).toBe(true);
    expect(permissionMap.can_access_internal_admin).toBe(false);
    expect(permissionMap.can_manage_users).toBe(false);
    expect(permissionMap.can_manage_global_templates).toBe(false);
    expect(permissionMap.can_override_system_controls).toBe(false);
    expect(permissionMap.can_manage_company_users).toBe(true);
    expect(permissionMap.can_manage_billing).toBe(true);
    expect(permissionMap.can_create_documents).toBe(true);
    expect(permissionMap.can_edit_documents).toBe(true);
    expect(permissionMap.can_submit_documents).toBe(true);
    expect(permissionMap.can_manage_daps).toBe(true);
    expect(permissionMap.can_manage_observations).toBe(true);
  });
});
