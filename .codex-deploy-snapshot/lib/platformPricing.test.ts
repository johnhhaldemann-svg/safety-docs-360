import { describe, expect, it } from "vitest";
import {
  applyCompanyFeatureEntitlementsToPermissionMap,
  normalizeAddonSelections,
  normalizeFeatureKeys,
} from "@/lib/platformPricing";
import { getPermissionMap } from "@/lib/rbac";

describe("platformPricing", () => {
  it("normalizes feature keys and preserves null as legacy unconfigured", () => {
    expect(normalizeFeatureKeys(null)).toBeNull();
    expect(normalizeFeatureKeys(["jobsites", "bad", "jobsites"])).toEqual(["jobsites"]);
  });

  it("normalizes fixed-price add-ons for invoice drafts", () => {
    expect(
      normalizeAddonSelections([
        { key: "sms_text_alerts", quantity: 2, unitPriceCents: 100000, label: "" },
        { key: "not_real", unitPriceCents: 1 },
      ])
    ).toEqual([
      {
        key: "sms_text_alerts",
        label: "SMS / Text Alert Package",
        quantity: 2,
        unitPriceCents: 100000,
      },
    ]);
  });

  it("removes permissions for disabled company feature modules", () => {
    const base = getPermissionMap("company_admin");
    const next = applyCompanyFeatureEntitlementsToPermissionMap(base, [
      "dashboard_command_center",
      "jobsites",
    ]);

    expect(next.can_view_dashboards).toBe(true);
    expect(next.can_access_jobsites).toBe(true);
    expect(next.can_access_document_library).toBe(false);
    expect(next.can_access_field_work).toBe(false);
  });
});

