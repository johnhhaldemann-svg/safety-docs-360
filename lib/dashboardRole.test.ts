import { describe, expect, it } from "vitest";
import { resolveDashboardRole } from "@/lib/dashboardRole";

describe("resolveDashboardRole", () => {
  it("resolves company leadership dashboards directly", () => {
    expect(resolveDashboardRole("company_admin")).toBe("company_admin");
    expect(resolveDashboardRole("Safety Manager")).toBe("safety_manager");
  });

  it("routes field supervisor and legacy foreman users to the same dashboard", () => {
    expect(resolveDashboardRole("field_supervisor")).toBe("field_supervisor");
    expect(resolveDashboardRole("Field Supervisor")).toBe("field_supervisor");
    expect(resolveDashboardRole("foreman")).toBe("field_supervisor");
  });

  it("falls back safely for unknown or missing roles", () => {
    expect(resolveDashboardRole("viewer")).toBe("default");
    expect(resolveDashboardRole("")).toBe("default");
    expect(resolveDashboardRole(undefined)).toBe("default");
    expect(resolveDashboardRole("mystery_role")).toBe("default");
  });
});
