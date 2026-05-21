import { describe, expect, it } from "vitest";
import { mapChecklistEvidence } from "@/lib/compliance/checklistMapping";
import { buildChecklistMatrixRows, summarizeChecklistRows } from "@/lib/compliance/checklistScoring";

describe("checklist scoring", () => {
  it("returns needs_user_input when always-required evidence is missing", () => {
    const evidenceRows = mapChecklistEvidence("peshep", {
      project_name: "Campus Reno",
      scope_of_work_selected: ["Hot Work"],
    });
    const rows = buildChecklistMatrixRows(evidenceRows);
    const policy = rows.find((row) => row.id === "company-formal-policy");
    expect(policy?.coverage).toBe("needs_user_input");
    expect(policy?.aiAction).toBe("validate");
  });

  it("summarizes checklist row totals", () => {
    const evidenceRows = mapChecklistEvidence("csep", {
      emergency_procedures: "Emergency contacts posted at entry.",
      required_ppe: ["Hard Hat", "Gloves"],
      selected_hazards: ["Chemical exposure"],
      additional_permits: ["Chemical Permit"],
    });
    const rows = buildChecklistMatrixRows(evidenceRows);
    const summary = summarizeChecklistRows(rows);
    expect(summary.total).toBe(rows.length);
    expect(summary.needsUserInput).toBeGreaterThan(0);
  });

  it("marks applicable single-signal rows as partial", () => {
    const evidenceRows = mapChecklistEvidence("csep", {
      tasks: ["Welding"],
    });
    const rows = buildChecklistMatrixRows(evidenceRows);
    const planning = rows.find((row) => row.id === "company-planning-jha-sop");
    expect(planning?.coverage).toBe("partial");
  });
});
