import { describe, expect, it } from "vitest";
import { getPermissionMap } from "@/lib/rbac";
import { resolveMobileFeatureMap, visibleMobileFeatures } from "@/lib/mobileEntitlements";

describe("mobile entitlements", () => {
  it("enables field app modules for field supervisors by default", () => {
    const features = resolveMobileFeatureMap({
      role: "field_supervisor",
      permissionMap: getPermissionMap("field_supervisor"),
    });

    expect(features.mobile_dashboard).toBe(true);
    expect(features.mobile_jsa).toBe(true);
    expect(features.mobile_field_issues).toBe(true);
    expect(features.mobile_field_audits).toBe(true);
    expect(features.mobile_photos).toBe(true);
    expect(features.mobile_signatures).toBe(true);
  });

  it("keeps field users focused on issue and audit capture unless explicitly enabled", () => {
    const features = resolveMobileFeatureMap({
      role: "field_user",
      permissionMap: getPermissionMap("field_user"),
    });

    expect(visibleMobileFeatures(features)).toEqual([
      "mobile_dashboard",
      "mobile_field_issues",
      "mobile_field_audits",
      "mobile_photos",
    ]);
  });

  it("applies explicit user overrides after company defaults", () => {
    const features = resolveMobileFeatureMap({
      role: "field_user",
      permissionMap: getPermissionMap("field_user"),
      companyOverrides: [{ feature: "mobile_jsa", enabled: false }],
      userOverrides: [{ feature: "mobile_jsa", enabled: true }],
    });

    expect(features.mobile_jsa).toBe(true);
    expect(features.mobile_signatures).toBe(false);
  });
});
