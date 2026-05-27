import { describe, expect, it } from "vitest";
import { buildOwnerValidationPreviewRoles } from "@/lib/superadmin/ownerValidationPreview";

function permissionFor(roleId: string, permissionLabel: string) {
  const role = buildOwnerValidationPreviewRoles().find((item) => item.id === roleId);
  const permission = role?.permissions.find((item) => item.label === permissionLabel);
  return { role, permission };
}

describe("buildOwnerValidationPreviewRoles", () => {
  it("creates the six owner-requested preview roles", () => {
    const roles = buildOwnerValidationPreviewRoles();

    expect(roles.map((role) => role.label)).toEqual([
      "Company Admin",
      "Safety Manager",
      "Foreman",
      "Employee",
      "Client Viewer",
      "Auditor",
    ]);
  });

  it("never grants Owner Validation Console access to preview roles", () => {
    const roles = buildOwnerValidationPreviewRoles();

    for (const role of roles) {
      expect(
        role.permissions.find((permission) => permission.label === "Access Owner Validation Console")?.allowed
      ).toBe(false);
    }
  });

  it("shows expected high-risk role boundaries in plain English", () => {
    expect(permissionFor("company_admin", "Manage users").permission?.allowed).toBe(true);
    expect(permissionFor("employee", "Manage users").permission?.allowed).toBe(false);
    expect(permissionFor("client_viewer", "Create JSA").permission?.allowed).toBe(false);
    expect(permissionFor("auditor", "View documents").permission?.allowed).toBe(true);
  });
});
