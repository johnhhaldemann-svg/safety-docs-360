import { describe, expect, it } from "vitest";
import { companyAdminSideSections } from "@/lib/appNavigation";
import { mapSafePredictSurfaceHref } from "@/lib/safePredictRouteMap";
import {
  canViewSafePredictPlatformActions,
  filterSafePredictPlatformActions,
  safePredictPlatformActions,
  safePredictPlatformActionSections,
} from "@/lib/safePredictPlatformActions";

describe("safePredictPlatformActions", () => {
  it("limits the SafePredict platform actions hub to super admin roles", () => {
    expect(canViewSafePredictPlatformActions("super_admin")).toBe(true);
    expect(canViewSafePredictPlatformActions("superadmin")).toBe(true);

    for (const role of ["platform_admin", "admin", "company_admin", "sales_demo", "", null]) {
      expect(canViewSafePredictPlatformActions(role), String(role)).toBe(false);
    }
  });

  it("exposes company admin actions through SafePredict beta routes", () => {
    const safePredictHrefs = new Set(safePredictPlatformActions.map((action) => action.href));
    const originalCompanyHrefs = companyAdminSideSections
      .flatMap((section) => section.items)
      .map((item) => item.href)
      .filter((href) => href !== "/safe-predict");

    for (const href of originalCompanyHrefs) {
      expect(safePredictHrefs.has(mapSafePredictSurfaceHref(href)), href).toBe(true);
    }
  });

  it("keeps platform sections grouped by source for the action hub", () => {
    expect(safePredictPlatformActionSections.some((section) => section.source === "company")).toBe(true);
    expect(safePredictPlatformActionSections.some((section) => section.source === "admin")).toBe(true);
    expect(safePredictPlatformActionSections.some((section) => section.source === "superadmin")).toBe(true);
  });

  it("searches action labels, routes, and section names", () => {
    expect(filterSafePredictPlatformActions(safePredictPlatformActions, "permits").map((action) => action.href)).toContain("/safe-predict/permit-center");
    expect(filterSafePredictPlatformActions(safePredictPlatformActions, "apps").map((action) => action.href)).toContain("/safe-predict/apps-integrations");
    expect(filterSafePredictPlatformActions(safePredictPlatformActions, "team").map((action) => action.href)).toContain("/safe-predict/team-access");
    expect(filterSafePredictPlatformActions(safePredictPlatformActions, "superadmin").length).toBeGreaterThan(0);
  });
});
