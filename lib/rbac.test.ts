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

  it("grants only the curated demo permissions", () => {
    const permissionMap = getPermissionMap("sales_demo");

    expect(permissionMap.can_view_dashboards).toBe(true);
    expect(permissionMap.can_view_reports).toBe(true);
    expect(permissionMap.can_access_internal_admin).toBe(false);
    expect(permissionMap.can_manage_company_users).toBe(false);
    expect(permissionMap.can_manage_billing).toBe(false);
    expect(permissionMap.can_create_documents).toBe(false);
    expect(permissionMap.can_edit_documents).toBe(false);
    expect(permissionMap.can_submit_documents).toBe(false);
  });
});
