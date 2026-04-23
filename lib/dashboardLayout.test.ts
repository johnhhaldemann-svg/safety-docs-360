import { describe, expect, it } from "vitest";
import {
  getAvailableDashboardBlockIds,
  getDashboardRoleDefaultLayout,
  getDashboardSlotOptionIds,
  normalizeDashboardLayout,
  validateDashboardLayout,
} from "@/lib/dashboardLayout";

describe("dashboardLayout", () => {
  it("requires exactly 10 blocks", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({ role: "company_admin" });
    const result = validateDashboardLayout({
      layout: availableBlockIds.slice(0, 9),
      availableBlockIds,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toContain("exactly 10");
  });

  it("rejects duplicate blocks", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({ role: "company_admin" });
    const layout = [...availableBlockIds.slice(0, 9), availableBlockIds[0]];
    const result = validateDashboardLayout({
      layout,
      availableBlockIds,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toContain("duplicate");
  });

  it("rejects invalid block ids", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({ role: "company_admin" });
    const result = validateDashboardLayout({
      layout: [...availableBlockIds.slice(0, 9), "not_a_real_block"],
      availableBlockIds,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toContain("Unknown dashboard block id");
  });

  it("normalizes malformed layouts with role defaults", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({ role: "default" });
    const defaultLayout = getDashboardRoleDefaultLayout("default");
    const normalized = normalizeDashboardLayout({
      layout: ["metric_primary", "metric_primary", "recent_activity"],
      defaultLayout,
      availableBlockIds,
    });

    expect(normalized).toHaveLength(10);
    expect(new Set(normalized).size).toBe(10);
    expect(normalized[0]).toBe("metric_primary");
    expect(normalized[1]).toBe("recent_activity");
  });

  it("preserves still-valid blocks across role changes and backfills invalid ones", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({
      role: "default",
      permissionMap: { can_view_analytics: false, can_view_reports: false } as never,
    });
    const defaultLayout = getDashboardRoleDefaultLayout("default");
    const normalized = normalizeDashboardLayout({
      layout: [
        "metric_primary",
        "metric_secondary",
        "company_access",
        "risk_ranking",
        "recent_activity",
        "recent_documents",
        "support_signals",
        "training_signal",
        "permit_followups",
        "incident_followups",
      ],
      defaultLayout,
      availableBlockIds,
    });

    expect(normalized).toHaveLength(10);
    expect(normalized).toContain("metric_primary");
    expect(normalized).toContain("recent_activity");
    expect(normalized).not.toContain("company_access");
    expect(normalized).not.toContain("risk_ranking");
  });

  it("omits already-selected blocks from other slot pickers", () => {
    const layout = getDashboardRoleDefaultLayout("company_admin");
    const optionIds = getDashboardSlotOptionIds({
      layout,
      availableBlockIds: getAvailableDashboardBlockIds({ role: "company_admin" }),
      slotIndex: 0,
    });

    expect(optionIds).toContain(layout[0]);
    expect(optionIds).not.toContain(layout[1]);
  });

  it("makes graph blocks available for dashboard customization", () => {
    const availableBlockIds = getAvailableDashboardBlockIds({ role: "company_admin" });

    expect(availableBlockIds).toContain("graph_hazard_trends");
    expect(availableBlockIds).toContain("graph_jobsite_risk");
    expect(availableBlockIds).toContain("graph_observation_mix");
  });
});
