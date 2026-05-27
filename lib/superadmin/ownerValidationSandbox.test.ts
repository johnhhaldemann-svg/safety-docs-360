import { describe, expect, it } from "vitest";
import {
  SAFETY360_TEST_COMPANY_KEY,
  SAFETY360_TEST_COMPANY_NAME,
  getSafety360SandboxSeedPlan,
} from "@/lib/superadmin/ownerValidationSandbox";

describe("Safety360 Test Company sandbox plan", () => {
  it("uses a clearly named sandbox company", () => {
    expect(SAFETY360_TEST_COMPANY_NAME).toBe("Safety360 Test Company");
    expect(SAFETY360_TEST_COMPANY_KEY).toBe("safety360-test-company");
  });

  it("includes the owner-requested fake validation data categories", () => {
    const plan = getSafety360SandboxSeedPlan();

    expect(plan.employees.map((employee) => employee[1])).toEqual([
      "company_admin",
      "safety_manager",
      "foreman",
      "employee",
      "client_viewer",
      "auditor",
    ]);
    expect(plan.jobsites).toEqual([
      "Active construction jobsite",
      "High-risk jobsite",
      "Completed jobsite",
    ]);
    expect(plan.jsas).toContain("Complete JSA");
    expect(plan.jsas).toContain("Incomplete JSA");
    expect(plan.jsas).toContain("High-risk JSA");
    expect(plan.permits).toContain("Hot Work permit");
    expect(plan.permits).toContain("Confined Space permit");
    expect(plan.permits).toContain("Excavation permit");
    expect(plan.permits).toContain("LOTO permit");
    expect(plan.trainingStates).toEqual(["Current training", "Expired training", "Missing training"]);
    expect(plan.observations).toEqual(["Safe observation", "Unsafe observation", "Near-miss observation"]);
    expect(plan.incidents).toEqual(["Minor incident", "Serious incident draft", "Near miss"]);
    expect(plan.correctiveActions).toEqual(["Open item", "Completed item", "Overdue item"]);
    expect(plan.documents).toEqual(["Sample safety plan", "Sample JSA export", "Sample permit export"]);
  });
});
