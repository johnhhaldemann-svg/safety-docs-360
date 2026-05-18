import { describe, expect, it } from "vitest";
import {
  COMPANY_PLATFORM_ROUTE,
  PLATFORM_ADMIN_ROUTE,
  PLATFORM_SUPERADMIN_ROUTE,
  resolvePostLoginRoute,
} from "@/lib/postLoginRoute";

describe("resolvePostLoginRoute", () => {
  it("uses the Superadmin hub as the platform superadmin entry point", () => {
    expect(PLATFORM_SUPERADMIN_ROUTE).toBe("/superadmin");
  });

  it("keeps company users in the Beta working platform", () => {
    expect(resolvePostLoginRoute("company_admin")).toBe(COMPANY_PLATFORM_ROUTE);
    expect(resolvePostLoginRoute("manager")).toBe(COMPANY_PLATFORM_ROUTE);
    expect(resolvePostLoginRoute("field_user")).toBe(COMPANY_PLATFORM_ROUTE);
    expect(resolvePostLoginRoute(undefined)).toBe(COMPANY_PLATFORM_ROUTE);
  });

  it("sends platform admin roles to the platform admin area", () => {
    expect(resolvePostLoginRoute("platform_admin")).toBe(PLATFORM_ADMIN_ROUTE);
    expect(resolvePostLoginRoute("platformadmin")).toBe(PLATFORM_ADMIN_ROUTE);
    expect(resolvePostLoginRoute("admin")).toBe(PLATFORM_ADMIN_ROUTE);
    expect(resolvePostLoginRoute("viewer", { can_access_internal_admin: true })).toBe(
      PLATFORM_ADMIN_ROUTE
    );
  });

  it("sends superadmin directly to the superadmin platform area", () => {
    expect(resolvePostLoginRoute("super_admin")).toBe(PLATFORM_SUPERADMIN_ROUTE);
    expect(resolvePostLoginRoute("superadmin")).toBe(PLATFORM_SUPERADMIN_ROUTE);
    expect(resolvePostLoginRoute("Super Admin")).toBe(PLATFORM_SUPERADMIN_ROUTE);
  });
});
