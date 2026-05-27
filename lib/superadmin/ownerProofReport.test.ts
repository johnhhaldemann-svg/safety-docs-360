import { describe, expect, it } from "vitest";
import { buildOwnerProofReportFromData } from "@/lib/superadmin/ownerProofReport";
import type { OwnerValidationOverview } from "@/lib/superadmin/ownerValidationTypes";
import type { OwnerChangeLogEntry } from "@/lib/superadmin/ownerChangeLog";

function moduleRow(module_key: string, display_name: string, status: "green" | "yellow" | "red" | "gray") {
  return {
    module_key,
    display_name,
    status,
    summary: `${display_name} summary`,
    last_tested_at: "2026-05-27T10:00:00.000Z",
    last_tested_by: "owner-1",
    related_page_url: "/test",
    customer_ready: false,
    created_at: "2026-05-27T10:00:00.000Z",
    updated_at: "2026-05-27T10:00:00.000Z",
  };
}

const baseOverview: OwnerValidationOverview = {
  modules: [
    moduleRow("documents", "Documents", "green"),
    moduleRow("gus_ai", "Gus", "yellow"),
    moduleRow("permits", "Permits", "red"),
    moduleRow("mobile", "Mobile", "gray"),
  ],
  recentRuns: [
    {
      id: "run-1",
      started_at: "2026-05-27T10:00:00.000Z",
      completed_at: "2026-05-27T10:02:00.000Z",
      started_by: "owner-1",
      overall_status: "red",
      overall_score: 63,
      passed_count: 1,
      warning_count: 1,
      failed_count: 1,
      summary: "Latest run found one failure.",
      created_at: "2026-05-27T10:00:00.000Z",
    },
  ],
  manualReviewItems: [
    {
      id: "item-1",
      module_key: "documents",
      checklist_item: "Export PDF",
      status: "passed",
      required: true,
      completed: true,
      completed_by: "owner-1",
      completed_at: "2026-05-27T10:00:00.000Z",
      notes: null,
      created_at: "2026-05-27T10:00:00.000Z",
      updated_at: "2026-05-27T10:00:00.000Z",
    },
    {
      id: "item-2",
      module_key: "gus_ai",
      checklist_item: "Review Gus",
      status: "needs_review",
      required: true,
      completed: false,
      completed_by: null,
      completed_at: null,
      notes: null,
      created_at: "2026-05-27T10:00:00.000Z",
      updated_at: "2026-05-27T10:00:00.000Z",
    },
  ],
  customerReadyGates: [
    {
      module_key: "documents",
      automated_validation_status: "green",
      owner_visual_review_status: "passed",
      customer_ready_status: "Approved for demo",
      customer_ready: false,
      blocking_reason: null,
      super_admin_approved: false,
      approved_by: null,
      approved_at: null,
      latest_owner_proof_report_id: "run-1",
      created_at: "2026-05-27T10:00:00.000Z",
      updated_at: "2026-05-27T10:00:00.000Z",
    },
    {
      module_key: "permits",
      automated_validation_status: "red",
      owner_visual_review_status: "failed",
      customer_ready_status: "Blocked",
      customer_ready: false,
      blocking_reason: "Permit export failed.",
      super_admin_approved: false,
      approved_by: null,
      approved_at: null,
      latest_owner_proof_report_id: "run-1",
      created_at: "2026-05-27T10:00:00.000Z",
      updated_at: "2026-05-27T10:00:00.000Z",
    },
  ],
};

const recentChange: OwnerChangeLogEntry = {
  id: "change-1",
  change_key: "owner-report",
  changed_at: "2026-05-27T10:00:00.000Z",
  module_key: "owner_validation",
  module_name: "Owner Validation",
  plain_english_description: "Added owner proof report.",
  files_changed: [],
  pages_affected: [],
  risk_level: "Medium",
  owner_review_required: true,
  validation_checklist_url: "/superadmin/owner-validation",
  related_page_url: "/superadmin/owner-validation/report",
  customer_ready_status: "Needs owner review",
  why_changed: "Owner needs a report.",
  what_could_break: "Report data could fail to load.",
  owner_manual_review: "Open the report.",
  safe_to_show_customer: "Needs Review",
  created_by: "owner-1",
  created_at: "2026-05-27T10:00:00.000Z",
  updated_at: "2026-05-27T10:00:00.000Z",
};

describe("buildOwnerProofReportFromData", () => {
  it("summarizes modules, gates, checklist completion, risks, and customer readiness", () => {
    const report = buildOwnerProofReportFromData({
      overview: baseOverview,
      latestRunChecks: [
        {
          id: "check-1",
          run_id: "run-1",
          module_key: "permits",
          check_name: "Permit export",
          status: "red",
          result: "Permit export failed.",
          technical_details: null,
          recommended_owner_action: "Fix permit export before demo.",
          created_at: "2026-05-27T10:00:00.000Z",
        },
      ],
      recentChanges: [recentChange],
    });

    expect(report.summary.overallStatus).toBe("red");
    expect(report.summary.safeToDemo).toBe("No");
    expect(report.summary.safeForCustomerUse).toBe("Needs Review");
    expect(report.modulesPassed).toHaveLength(1);
    expect(report.modulesFailed).toHaveLength(1);
    expect(report.modulesNotTested).toHaveLength(1);
    expect(report.blockedModules).toHaveLength(1);
    expect(report.manualChecklist.completionPercent).toBe(50);
    expect(report.topRisks.join(" ")).toContain("Permit export failed");
    expect(report.recommendedNextActions).toContain("Fix permit export before demo.");
  });
});
